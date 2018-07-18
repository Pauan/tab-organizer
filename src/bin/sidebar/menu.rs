use {visible, MENU_ITEM_HOVER_STYLE, MENU_ITEM_SHADOW_STYLE};
use futures_signals::signal::{Signal, IntoSignal, SignalExt, Mutable};
use dominator::{Dom, DomBuilder, text, HIGHEST_ZINDEX};
use dominator::events::{MouseEnterEvent, MouseLeaveEvent, ClickEvent};
use stdweb::web::IElement;


lazy_static! {
    static ref TOP_STYLE: String = class! {
        .style("position", "absolute")
        .style("top", "100%")
        .style("right", "0px")
        .style("z-index", HIGHEST_ZINDEX)
    };

    static ref MODAL_STYLE: String = class! {
        .style("position", "fixed")
        .style("left", "0px")
        .style("top", "0px")
        .style("width", "100%")
        .style("height", "100%")
        .style("background-color", "hsla(0, 0%, 0%, 0.15)")
    };

    static ref MENU_STYLE: String = class! {
        //.style("overflow", "hidden")
        .style("border", "1px solid black")
        .style("background-color", "white")
        .style("white-space", "pre")
    };

    static ref SUBMENU_CHILDREN_STYLE: String = class! {
        .style("position", "absolute")
        .style("top", "-1px")
        .style("right", "100%")
    };

    static ref MENU_ITEM_STYLE: String = class! {
        .style("margin", "-1px")
        .style("padding-top", "1px")
        .style("padding-bottom", "1px")
        .style("padding-left", "5px")
        .style("padding-right", "5px")
        .style("color", "black")
        .style("text-shadow", "none")
    };

    static ref SEPARATOR_STYLE: String = class! {
        .style("background-color", "gainsboro")
        .style("margin", "2px 3px")
        .style("height", "1px")
    };
}


fn eq_index<A>(signal: A, index: usize) -> impl Signal<Item = bool> where A: IntoSignal<Item = Option<usize>> {
    signal.into_signal().map(move |hovered| {
        hovered.map(|hovered| hovered == index).unwrap_or(false)
    })
}


enum MenuState {
    Submenu {
        hovered: Mutable<Option<usize>>,
        children: Vec<MenuState>,
    },
    Item {
        hovered: Mutable<bool>,
    },
}

impl MenuState {
    fn reset(&self) {
        match self {
            MenuState::Submenu { hovered, children } => {
                hovered.set_neq(None);

                for state in children {
                    state.reset();
                }
            },
            MenuState::Item { hovered } => {
                hovered.set_neq(false);
            },
        }
    }
}


pub(crate) struct MenuBuilder {
    states: Vec<MenuState>,
    children: Vec<Dom>,
    hovered: Mutable<Option<usize>>,
}

impl MenuBuilder {
    fn new() -> Self {
        Self {
            states: vec![],
            children: vec![],
            hovered: Mutable::new(None),
        }
    }

    fn menu_item<A>(&mut self) -> impl FnOnce(DomBuilder<A>) -> DomBuilder<A> where A: IElement + Clone + 'static {
        let index = self.children.len();

        let mutable = self.hovered.clone();

        let hovered = Mutable::new(false);

        self.states.push(MenuState::Item {
            hovered: hovered.clone(),
        });

        // TODO is this inline a good idea ?
        #[inline]
        move |dom| { dom
            .class(&MENU_ITEM_STYLE)
            // TODO hacky
            .class(&super::MENU_ITEM_STYLE)

            .class_signal(&MENU_ITEM_HOVER_STYLE, hovered.signal())
            .class_signal(&MENU_ITEM_SHADOW_STYLE, hovered.signal())

            .event(clone!(hovered => move |_: MouseEnterEvent| {
                hovered.set_neq(true);
                mutable.set_neq(Some(index));
            }))

            .event(move |_: MouseLeaveEvent| {
                hovered.set_neq(false);
            })
        }
    }


    fn push_submenu<F>(&mut self, name: &str, f: F) where F: FnOnce(MenuBuilder) -> MenuBuilder {
        let index = self.children.len();

        let MenuBuilder { states, mut children, hovered } = f(MenuBuilder::new());

        self.states.push(MenuState::Submenu {
            hovered,
            children: states,
        });

        self.children.push(html!("div", {
            .class(&MENU_ITEM_STYLE)
            // TODO hacky
            .class(&super::MENU_ITEM_STYLE)

            .class_signal(&MENU_ITEM_HOVER_STYLE, eq_index(self.hovered.signal(), index))
            .class_signal(&MENU_ITEM_SHADOW_STYLE, eq_index(self.hovered.signal(), index))

            // TODO make this cleaner
            .event({
                let hovered = self.hovered.clone();
                move |_: MouseEnterEvent| {
                    hovered.set_neq(Some(index));
                }
            })

            .children(&mut [
                text(name),

                html!("div", {
                    .class(&MENU_STYLE)
                    .class(&SUBMENU_CHILDREN_STYLE)

                    .mixin(visible(eq_index(self.hovered.signal(), index)))

                    .children(&mut children)
                })
            ])
        }));
    }

    #[inline]
    pub(crate) fn submenu<F>(mut self, name: &str, f: F) -> Self where F: FnOnce(MenuBuilder) -> MenuBuilder {
        self.push_submenu(name, f);
        self
    }


    fn push_separator(&mut self) {
        self.children.push(html!("hr", {
            .class(&SEPARATOR_STYLE)
        }));
    }

    #[inline]
    pub(crate) fn separator(mut self) -> Self {
        self.push_separator();
        self
    }


    fn push_option<A>(&mut self, name: &str, value: A) {
        let mixin = self.menu_item();

        self.children.push(html!("div", {
            .mixin(mixin)

            .children(&mut [
                text(name)
            ])
        }));
    }

    #[inline]
    pub(crate) fn option<A>(mut self, name: &str, value: A) -> Self {
        self.push_option(name, value);
        self
    }
}


pub(crate) struct Menu {
    visible: Mutable<bool>,
}

impl Menu {
    pub(crate) fn new() -> Self {
        Self {
            visible: Mutable::new(false),
        }
    }

    pub(crate) fn show(&self) {
        self.visible.set_neq(true);
    }

    pub(crate) fn render<F>(&self, f: F) -> Dom where F: FnOnce(MenuBuilder) -> MenuBuilder {
        let MenuBuilder { states, mut children, hovered } = f(MenuBuilder::new());

        html!("div", {
            .class(&TOP_STYLE)

            .mixin(visible(self.visible.signal()))

            .children(&mut [
                html!("div", {
                    .class(&MODAL_STYLE)

                    // TODO make this cleaner
                    .event({
                        let visible = self.visible.clone();
                        move |_: ClickEvent| {
                            visible.set_neq(false);

                            hovered.set_neq(None);

                            for state in states.iter() {
                                state.reset();
                            }
                        }
                    })
                }),

                html!("div", {
                    .class(&MENU_STYLE)

                    .children(&mut children)
                }),
            ])
        })
    }
}
