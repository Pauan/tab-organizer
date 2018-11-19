use crate::constants::{ROW_STYLE, MODAL_STYLE, STRETCH_STYLE, MENU_ITEM_HOVER_STYLE};
use std::sync::{RwLock, Arc};
use futures_signals::signal::{Signal, SignalExt, Mutable};
use dominator::{Dom, DomBuilder, HIGHEST_ZINDEX};
use dominator::events::{MouseEnterEvent, MouseLeaveEvent, ClickEvent};
use stdweb::web::IElement;


lazy_static! {
    static ref TOP_STYLE: String = class! {
        .style("position", "absolute")
        .style("top", "100%")
        .style("right", "0px")
        .style("z-index", HIGHEST_ZINDEX)
    };

    static ref MENU_STYLE: String = class! {
        //.style("overflow", "hidden")
        .style("border", "1px solid black")
        .style("background-color", "white")
        .style("white-space", "pre")
        .style("box-shadow", "1px 1px 2px hsla(0, 0%, 0%, 0.25)")
    };

    static ref MENU_CHEVRON_STYLE: String = class! {
        .style("width", "7px")
        .style("height", "7px")
        .style("margin-left", "5px")
        .style("margin-right", "-3px")
    };

    static ref SUBMENU_CHILDREN_STYLE: String = class! {
        .style("position", "absolute")
        .style("top", "-1px")
        .style("right", "100%")
    };

    static ref MENU_ITEM_STYLE: String = class! {
        .style("margin-top", "-1px")
        .style("margin-bottom", "-1px")
        .style("padding-top", "1px")
        .style("padding-bottom", "1px")
        .style("padding-left", "5px")
        .style("padding-right", "5px")
        .style("color", "black")
        .style("text-shadow", "none")
        .style("border-left", "none")
        .style("border-right", "none")
    };

    static ref MENU_ITEM_SUBMENU_STYLE: String = class! {
        // TODO a tiny bit hacky
        .style("cursor", "default")
    };

    static ref MENU_ITEM_SELECTED_STYLE: String = class! {
        .style("font-weight", "bold")
    };

    // TODO code duplication with main.rs
    static ref MENU_ITEM_SHADOW_STYLE: String = class! {
        .style("box-shadow", "      0px 1px  1px hsla(0, 0%,   0%, 0.25), \
                              inset 0px 0px  3px hsla(0, 0%, 100%, 1   ), \
                              inset 0px 0px 10px hsla(0, 0%, 100%, 0.25)")
    };

    static ref SEPARATOR_STYLE: String = class! {
        .style("background-color", "gainsboro")
        .style("margin", "2px 3px")
        .style("height", "1px")
    };
}


fn eq_index<A>(signal: A, index: usize) -> impl Signal<Item = bool> where A: Signal<Item = Option<usize>> {
    signal.map(move |hovered| {
        hovered.map(|hovered| hovered == index).unwrap_or(false)
    })
}


#[derive(Debug)]
enum MenuItemState {
    Submenu {
        hovered: Mutable<Option<usize>>,
    },
    Item {
        hovered: Mutable<bool>,
    },
}

impl MenuItemState {
    fn hide(&self) {
        match self {
            MenuItemState::Submenu { hovered } => {
                hovered.set_neq(None);
            },
            MenuItemState::Item { hovered } => {
                hovered.set_neq(false);
            },
        }
    }
}


#[derive(Debug)]
struct MenuState {
    visible: Mutable<bool>,
    states: RwLock<Vec<MenuItemState>>,
}

impl MenuState {
    fn new() -> Self {
        Self {
            visible: Mutable::new(false),
            states: RwLock::new(vec![]),
        }
    }

    fn show(&self) {
        self.visible.set_neq(true);
    }

    fn hide(&self) {
        let lock = self.states.read().unwrap();

        self.visible.set_neq(false);

        for state in lock.iter() {
            state.hide();
        }
    }

    fn add(&self, state: MenuItemState) {
        let mut lock = self.states.write().unwrap();
        lock.push(state);
    }
}


pub(crate) struct MenuBuilder {
    state: Arc<MenuState>,
    children: Vec<Dom>,
    hovered: Mutable<Option<usize>>,
}

impl MenuBuilder {
    fn new(state: Arc<MenuState>) -> Self {
        Self {
            state,
            children: vec![],
            hovered: Mutable::new(None),
        }
    }

    fn menu_item<A>(&mut self) -> impl FnOnce(DomBuilder<A>) -> DomBuilder<A> where A: IElement + Clone + 'static {
        let index = self.children.len();

        let mutable = self.hovered.clone();

        let hovered = Mutable::new(false);

        self.state.add(MenuItemState::Item {
            hovered: hovered.clone(),
        });

        // TODO is this inline a good idea ?
        #[inline]
        move |dom| { dom
            .class(&*ROW_STYLE)
            .class(&*MENU_ITEM_STYLE)
            // TODO hacky
            .class(&*super::MENU_ITEM_STYLE)

            .class_signal(&*MENU_ITEM_HOVER_STYLE, hovered.signal())
            .class_signal(&*MENU_ITEM_SHADOW_STYLE, hovered.signal())

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

        let MenuBuilder { mut children, hovered, .. } = f(MenuBuilder::new(self.state.clone()));

        self.state.add(MenuItemState::Submenu {
            hovered,
        });

        self.children.push(html!("div", {
            .class(&*ROW_STYLE)
            .class(&*MENU_ITEM_STYLE)
            .class(&*MENU_ITEM_SUBMENU_STYLE)
            // TODO hacky
            .class(&*super::MENU_ITEM_STYLE)

            .class_signal(&*MENU_ITEM_HOVER_STYLE, eq_index(self.hovered.signal(), index))
            .class_signal(&*MENU_ITEM_SHADOW_STYLE, eq_index(self.hovered.signal(), index))

            // TODO make this cleaner
            .event({
                let hovered = self.hovered.clone();
                move |_: MouseEnterEvent| {
                    hovered.set_neq(Some(index));
                }
            })

            .children(&mut [
                // TODO figure out a way to avoid this wrapper div ?
                html!("div", {
                    .class(&*STRETCH_STYLE)
                    .text(name)
                }),

                html!("img", {
                    .class(&*MENU_CHEVRON_STYLE)
                    .attribute("src", "data/images/chevron-small-right.png")
                }),

                html!("div", {
                    .class(&*MENU_STYLE)
                    .class(&*SUBMENU_CHILDREN_STYLE)

                    .visible_signal(eq_index(self.hovered.signal(), index))

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
            .class(&*SEPARATOR_STYLE)
        }));
    }

    #[inline]
    pub(crate) fn separator(mut self) -> Self {
        self.push_separator();
        self
    }


    fn push_option<A, F>(&mut self, name: &str, signal: A, mut on_click: F)
        where A: Signal<Item = bool> + 'static,
              F: FnMut() + 'static {

        let mixin = self.menu_item();

        let state = self.state.clone();

        self.children.push(html!("div", {
            .apply(mixin)

            .class_signal(&*MENU_ITEM_SELECTED_STYLE, signal)

            .event(move |_: ClickEvent| {
                state.hide();
                on_click();
            })

            .text(name)
        }));
    }

    #[inline]
    pub(crate) fn option<A, F>(mut self, name: &str, signal: A, on_click: F) -> Self
        where A: Signal<Item = bool> + 'static,
              F: FnMut() + 'static {
        self.push_option(name, signal, on_click);
        self
    }
}


#[derive(Debug)]
pub(crate) struct Menu {
    state: Arc<MenuState>,
}

impl Menu {
    pub(crate) fn new() -> Self {
        Self {
            state: Arc::new(MenuState::new()),
        }
    }

    pub(crate) fn show(&self) {
        self.state.show();
    }

    pub(crate) fn render<F>(&self, f: F) -> Dom where F: FnOnce(MenuBuilder) -> MenuBuilder {
        let MenuBuilder { mut children, hovered, .. } = f(MenuBuilder::new(self.state.clone()));

        let state = self.state.clone();

        state.add(MenuItemState::Submenu {
            hovered,
        });

        html!("div", {
            .class(&*TOP_STYLE)

            .visible_signal(state.visible.signal())

            .children(&mut [
                html!("div", {
                    .class(&*MODAL_STYLE)

                    .event(move |_: ClickEvent| {
                        state.hide();
                    })
                }),

                html!("div", {
                    .class(&*MENU_STYLE)

                    .children(&mut children)
                }),
            ])
        })
    }
}
