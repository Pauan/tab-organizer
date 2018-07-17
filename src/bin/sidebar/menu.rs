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

#[inline]
fn menu_item<A>(mutable: &Mutable<Option<usize>>, index: usize) -> impl FnOnce(DomBuilder<A>) -> DomBuilder<A> where A: IElement + Clone + 'static {
    let mutable = mutable.clone();

    let hovered = Mutable::new(false);

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

        .event(clone!(hovered => move |_: MouseLeaveEvent| {
            hovered.set_neq(false);
        }))
    }
}


pub(crate) struct MenuBuilder {
    children: Vec<Dom>,
    hovered: Mutable<Option<usize>>,
}

impl MenuBuilder {
    fn new() -> Self {
        Self {
            children: vec![],
            hovered: Mutable::new(None),
        }
    }

    fn push_submenu<F>(&mut self, name: &str, f: F) where F: FnOnce(MenuBuilder) -> MenuBuilder {
        let MenuBuilder { mut children, .. } = f(MenuBuilder::new());

        let index = self.children.len();

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

                    .mixin(visible(self.hovered.signal().map(move |hovered| {
                        hovered.map(|hovered| hovered == index).unwrap_or(false)
                    })))

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
        let index = self.children.len();

        self.children.push(html!("div", {
            .mixin(menu_item(&self.hovered, index))

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
        let MenuBuilder { mut children, .. } = f(MenuBuilder::new());

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
