use tab_organizer::styles::*;
use std::sync::{RwLock, Arc};
use futures_signals::signal::{Signal, SignalExt, Mutable};
use dominator::{Dom, DomBuilder, HIGHEST_ZINDEX, html, clone, events, class, text};
use lazy_static::lazy_static;
use web_sys::{Element, EventTarget};


lazy_static! {
    static ref TOP_STYLE: String = class! {
        .style("position", "absolute")
        .style("top", "calc(100% + 4px)")
        .style("right", "0px")
        .style("z-index", HIGHEST_ZINDEX)
    };

    static ref MENU_ARROW_STYLE: String = class! {
        .style("width", "0px")
        .style("height", "0px")
        .style("border-left", "8px solid transparent")
        .style("border-right", "8px solid transparent")
        .style("border-bottom", "8px solid white")
        .style("position", "absolute")
        .style("top", "-7px")
        .style("right", "4px")
    };

    /*static ref MENU_ARROW_STYLE: String = class! {
        .style("width", "12px")
        .style("height", "12px")
        .style("border-top", "1px solid rgb(204, 204, 204)")
        .style("border-left", "1px solid rgb(204, 204, 204)")
        .style("transform", "rotate(45deg)")
        .style("position", "absolute")
        .style("background-color", "white")
        .style("top", "-6px")
        .style("right", "5px")
    };*/

    static ref MENU_MODAL_STYLE: String = class! {
        .style("background-color", "rgba(255, 255, 255, 0.4)")
    };

    static ref MENU_STYLE: String = class! {
        //.style("overflow", "hidden")
        .style("border", "1px solid rgb(204, 204, 204)")
        .style("box-shadow", "rgb(204, 204, 204) 0px 0px 5px")
    };

    static ref MENU_CHEVRON_STYLE: String = class! {
        .style("margin-left", "3px")
        .style("margin-right", "3px")

        .style("border-top", "2px solid rgb(117, 117, 118)")
        .style("border-right", "2px solid rgb(117, 117, 118)")
        .style("width", "5.07px")
        .style("height", "5.07px")
        .style("transform", "rotate(45deg)")
    };

    static ref SUBMENU_HEADER_STYLE: String = class! {
        .style("text-align", "center")
        .style("font-size", "13px")
        .style("height", "28px")
        .style("font-weight", "bold")
    };

    static ref SUBMENU_HEADER_BACK_STYLE: String = class! {
        .style("position", "absolute")
        .style("top", "-2px")
        .style("left", "4px")
        .style("width", "32px")
        .style("height", "32px")
        .style("z-index", "1")
    };

    static ref SUBMENU_HEADER_BACK_HOVER_STYLE: String = class! {
        .style("background-color", "rgb(237, 237, 237)")
    };

    static ref BACK_CHEVRON_STYLE: String = class! {
        .style("border-top", "2px solid rgb(12, 12, 13)")
        .style("border-left", "2px solid rgb(12, 12, 13)")
        .style("width", "6.48px")
        .style("height", "6.48px")
        .style("transform", "rotate(-45deg)")
    };

    static ref SUBMENU_STYLE: String = class! {
        .style("font-size", "12px")
        // TODO is this a good width ?
        .style("min-width", "200px")
        .style("background-color", "white")
        .style("white-space", "pre")
        .style("padding-top", "6px")
        .style("padding-bottom", "6px")
    };

    static ref MENU_ITEM_STYLE: String = class! {
        .style("cursor", "pointer")
        .style("position", "static")
        .style("height", "24px")
        //.style("padding-top", "1px")
        //.style("padding-bottom", "1px")
        .style("padding-left", "12px")
        .style("padding-right", "12px")
        .style("color", "black")
        .style("text-shadow", "none")
    };

    static ref MENU_ITEM_HOVER_STYLE: String = class! {
        .style("background-color", "rgb(237, 237, 237)")
    };

    /*static ref MENU_ITEM_SUBMENU_STYLE: String = class! {
        // TODO a tiny bit hacky
        .style("cursor", "default")
    };*/

    // TODO code duplication with render.rs
    static ref MENU_ITEM_SHADOW_STYLE: String = class! {
        .style("box-shadow", "      0px 1px  1px hsla(0, 0%,   0%, 0.25), \
                              inset 0px 0px  3px hsla(0, 0%, 100%, 1   ), \
                              inset 0px 0px 10px hsla(0, 0%, 100%, 0.25)")
    };

    static ref MENU_ICON_STYLE: String = class! {
        .style("width", "16px")
        .style("height", "16px")
        .style("margin-right", "9px")
    };

    static ref MENU_ICON_IMAGE_STYLE: String = class! {
        .style("width", "100%")
        .style("height", "100%")
    };

    static ref SEPARATOR_STYLE: String = class! {
        .style("background-color", "rgb(222, 222, 222)")
        .style("margin", "6px 0px")
        .style("height", "1px")
    };
}


#[derive(Debug)]
struct Parent {
    visible: Mutable<bool>,
}


#[derive(Debug)]
enum ChildState {
    Item {
        hovered: Mutable<bool>,
    },
    Submenu {
        visible: Mutable<bool>,
    },
}


// TODO verify that there aren't any Arc cycles
#[derive(Debug)]
struct MenuBuilderState {
    state: Arc<MenuState>,
    children: RwLock<Vec<ChildState>>,
}

impl MenuBuilderState {
    fn new(state: Arc<MenuState>) -> Self {
        Self {
            state,
            children: RwLock::new(vec![]),
        }
    }

    fn hide(&self) {
        self.state.visible.set_neq(false);
        self.hide_children();
    }

    fn hide_children(&self) {
        let lock = self.children.read().unwrap();

        for item in lock.iter() {
            match item {
                ChildState::Item { hovered } => {
                    hovered.set_neq(false);
                },
                ChildState::Submenu { visible } => {
                    visible.set_neq(false);
                },
            }
        }
    }

    fn push(&self, child: ChildState) {
        let mut lock = self.children.write().unwrap();

        lock.push(child);
    }
}


// TODO verify that there aren't any Arc cycles
#[derive(Debug)]
pub(crate) struct MenuBuilder {
    state: Arc<MenuBuilderState>,
    parent: Arc<Parent>,
    children: Vec<Dom>,
    submenus: Vec<Dom>,
}

impl MenuBuilder {
    fn new(state: Arc<MenuBuilderState>, parent: Arc<Parent>) -> Self {
        Self {
            state,
            parent,
            children: vec![],
            submenus: vec![],
        }
    }

    fn menu_item<A>(&mut self) -> impl FnOnce(DomBuilder<A>) -> DomBuilder<A> where A: AsRef<Element> + AsRef<EventTarget> + Clone + 'static {
        let hovered = Mutable::new(false);

        self.state.push(ChildState::Item {
            hovered: hovered.clone(),
        });

        // TODO is this inline a good idea ?
        #[inline]
        move |dom| { dom
            .class(&*ROW_STYLE)
            .class(&*MENU_ITEM_STYLE)

            .class_signal(&*MENU_ITEM_HOVER_STYLE, hovered.signal())
            //.class_signal(&*MENU_ITEM_SHADOW_STYLE, hovered.signal())

            .event(clone!(hovered => move |_: events::MouseEnter| {
                hovered.set_neq(true);
            }))

            .event(move |_: events::MouseLeave| {
                hovered.set_neq(false);
            })
        }
    }


    fn icon(url: Option<&str>) -> Dom {
        html!("div", {
            .class(&*MENU_ICON_STYLE)

            .apply(|dom| {
                if let Some(url) = url {
                    dom.children(&mut [
                        html!("img", {
                            .class(&*MENU_ICON_IMAGE_STYLE)
                            .attribute("src", url)
                            .attribute("alt", "")
                        }),
                    ])

                } else {
                    dom
                }
            })
        })
    }


    fn push_submenu<F>(&mut self, name: &str, icon: Option<&str>, f: F) where F: FnOnce(MenuBuilder) -> MenuBuilder {
        let visible = Mutable::new(false);

        let MenuBuilder { mut children, mut submenus, .. } = f(MenuBuilder::new(self.state.clone(), Arc::new(Parent {
            visible: visible.clone(),
        })));

        let parent = self.parent.clone();
        let state = self.state.clone();
        let mixin = self.menu_item();


        self.children.push(html!("div", {
            .apply(mixin)

            .event(clone!(state, visible => move |_: events::Click| {
                state.hide_children();
                visible.set_neq(true);
            }))

            .children(&mut [
                Self::icon(icon),

                // TODO figure out a way to avoid this wrapper div ?
                html!("div", {
                    .class(&*STRETCH_STYLE)
                    .text(name)
                }),

                html!("div", {
                    .class(&*MENU_CHEVRON_STYLE)
                }),
            ])
        }));


        let back_hover = Mutable::new(false);

        self.state.push(ChildState::Item {
            hovered: back_hover.clone(),
        });

        children.insert(0, html!("div", {
            .class([
                &*CENTER_STYLE,
                &*SUBMENU_HEADER_STYLE,
            ])

            .children(&mut [
                html!("div", {
                    .class([
                        &*CENTER_STYLE,
                        &*SUBMENU_HEADER_BACK_STYLE,
                    ])

                    .class_signal(&*SUBMENU_HEADER_BACK_HOVER_STYLE, back_hover.signal())

                    .event(clone!(back_hover => move |_: events::MouseEnter| {
                        back_hover.set_neq(true);
                    }))

                    .event(move |_: events::MouseLeave| {
                        back_hover.set_neq(false);
                    })

                    .event(clone!(state, parent => move |_: events::Click| {
                        state.hide_children();
                        parent.visible.set_neq(true);
                    }))

                    .children(&mut [
                        html!("div", {
                            .class(&*BACK_CHEVRON_STYLE)
                        })
                    ])
                }),

                text(name),
            ])
        }));

        // TODO code duplication
        children.insert(1, html!("hr", {
            .class(&*SEPARATOR_STYLE)
        }));

        self.state.push(ChildState::Submenu {
            visible: visible.clone(),
        });

        self.submenus.push(html!("div", {
            .class(&*SUBMENU_STYLE)

            .visible_signal(visible.signal())

            .children(&mut children)
        }));

        self.submenus.append(&mut submenus);
    }

    #[inline]
    pub(crate) fn submenu<F>(mut self, name: &str, icon: Option<&str>, f: F) -> Self where F: FnOnce(MenuBuilder) -> MenuBuilder {
        self.push_submenu(name, icon, f);
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


    fn push_toggle<A, F>(&mut self, name: &str, signal: A, mut on_click: F)
        where A: Signal<Item = bool> + 'static,
              F: FnMut() + 'static {

        let mixin = self.menu_item();

        let state = self.state.clone();

        self.children.push(html!("div", {
            .apply(mixin)

            .event(move |_: events::Click| {
                state.hide();
                on_click();
            })

            .children(&mut [
                html!("div", {
                    .class(&*MENU_ICON_STYLE)

                    .children(&mut [
                        html!("img", {
                            .class(&*MENU_ICON_IMAGE_STYLE)
                            .visible_signal(signal)
                            .attribute("src", "/icons/iconic/check.svg")
                            .attribute("alt", "")
                        }),
                    ])
                }),

                text(name),
            ])
        }));
    }

    #[inline]
    pub(crate) fn toggle<A, F>(mut self, name: &str, signal: A, on_click: F) -> Self
        where A: Signal<Item = bool> + 'static,
              F: FnMut() + 'static {
        self.push_toggle(name, signal, on_click);
        self
    }


    fn push_action<F>(&mut self, name: &str, icon: Option<&str>, mut on_click: F)
        where F: FnMut() + 'static {

        let mixin = self.menu_item();

        let state = self.state.clone();

        self.children.push(html!("div", {
            .apply(mixin)

            .event(move |_: events::Click| {
                state.hide();
                on_click();
            })

            .children(&mut [
                Self::icon(icon),
                text(name),
            ])
        }));
    }

    #[inline]
    pub(crate) fn action<F>(mut self, name: &str, icon: Option<&str>, on_click: F) -> Self
        where F: FnMut() + 'static {
        self.push_action(name, icon, on_click);
        self
    }


    fn push_header(&mut self, name: &str) {
        self.children.push(html!("div", {
            .class([
                &*CENTER_STYLE,
                &*SUBMENU_HEADER_STYLE,
            ])

            .text(name)
        }));
    }

    #[inline]
    pub(crate) fn header(mut self, name: &str) -> Self {
        self.push_header(name);
        self
    }
}


#[derive(Debug)]
struct MenuState {
    visible: Mutable<bool>,
}

impl MenuState {
    fn new() -> Self {
        Self {
            visible: Mutable::new(false),
        }
    }
}


// TODO verify that there aren't any Arc cycles
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
        self.state.visible.set_neq(true);
    }

    pub(crate) fn is_showing(&self) -> impl Signal<Item = bool> {
        self.state.visible.signal()
    }

    pub(crate) fn render<F>(&self, f: F) -> Dom where F: FnOnce(MenuBuilder) -> MenuBuilder {
        let menus = Arc::new(MenuBuilderState::new(self.state.clone()));
        let visible = Mutable::new(false);

        let MenuBuilder { mut children, mut submenus, .. } = f(MenuBuilder::new(menus.clone(), Arc::new(Parent {
            visible: visible.clone(),
        })));

        {
            menus.push(ChildState::Submenu {
                visible: visible.clone(),
            });

            submenus.insert(0, html!("div", {
                .class(&*SUBMENU_STYLE)

                .visible_signal(visible.signal())

                // TODO is there a better way of doing this ?
                .future(self.state.visible.signal().for_each(clone!(menus => move |show| {
                    if show {
                        visible.set_neq(true);

                    } else {
                        menus.hide_children();
                    }

                    async {}
                })))

                .children(&mut children)
            }));
        }

        html!("div", {
            .class(&*TOP_STYLE)

            .visible_signal(self.state.visible.signal())

            .children(&mut [
                html!("div", {
                    .class([
                        &*MODAL_STYLE,
                        &*MENU_MODAL_STYLE,
                    ])

                    .event(clone!(menus => move |_: events::Click| {
                        menus.hide();
                    }))

                    .event(move |_: events::ContextMenu| {
                        menus.hide();
                    })
                }),

                html!("div", {
                    .class(&*MENU_STYLE)

                    .children(&mut submenus)
                }),

                html!("div", {
                    .class(&*MENU_ARROW_STYLE)
                }),
            ])
        })
    }
}
