use tab_organizer::styles::*;
use futures_signals::signal::{and, always, Signal, SignalExt, Mutable};
use futures_signals::signal_vec::{SignalVec, SignalVecExt};
use dominator::{Dom, HIGHEST_ZINDEX, html, clone, events, class, text};
use lazy_static::lazy_static;


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
        .style("font-size", "12px")
        .style("background-color", "white")
        .style("white-space", "pre")
        .style("padding-top", "6px")
        .style("padding-bottom", "6px")

        // TODO is this a good width ?
        .style("min-width", "200px")
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

    static ref MENU_ITEM_STYLE: String = class! {
        .style("cursor", "pointer")
        .style("position", "static")
        .style("height", "24px")
        //.style("padding-top", "1px")
        //.style("padding-bottom", "1px")
        .style("padding-left", "12px")
        .style("padding-right", "12px")
        .style("color", "black")
        //.style("text-shadow", "none")
    };

    static ref MENU_ITEM_DISABLED_STYLE: String = class! {
        .style("cursor", "default")
        .style("opacity", "50%")
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


#[derive(Debug)]
pub(crate) struct Parent {
    menu_visible: Mutable<bool>,
    visible: Mutable<bool>,
}

impl Parent {
    pub(crate) fn header(&self, name: &str) -> Child {
        let dom = html!("div", {
            .class([
                &*CENTER_STYLE,
                &*SUBMENU_HEADER_STYLE,
            ])

            .visible_signal(self.visible.signal())

            .text(name)
        });

        Child { dom }
    }

    pub(crate) fn separator(&self) -> Child {
        let dom = html!("hr", {
            .class(&*SEPARATOR_STYLE)
            .visible_signal(self.visible.signal())
        });

        Child { dom }
    }

    fn action_<S, F>(&self, submenu: bool, name: &str, icon: Dom, signal: S, mut on_click: F) -> Child
        where S: Signal<Item = bool> + 'static,
              F: FnMut() + 'static {

        let menu_visible = self.menu_visible.clone();

        let enabled = Mutable::new(false);
        let hovered = Mutable::new(false);

        let dom = html!("div", {
            .class(&*ROW_STYLE)
            .class(&*MENU_ITEM_STYLE)

            .class_signal(&*MENU_ITEM_HOVER_STYLE, and(enabled.signal(), hovered.signal()))
            //.class_signal(&*MENU_ITEM_SHADOW_STYLE, hovered.signal())

            .visible_signal(self.visible.signal())

            .future(menu_visible.signal().for_each(clone!(hovered => move |x| {
                if !x {
                    hovered.set_neq(false);
                }

                async {}
            })))

            .event(clone!(hovered => move |_: events::MouseEnter| {
                hovered.set_neq(true);
            }))

            .event(move |_: events::MouseLeave| {
                hovered.set_neq(false);
            })

            .class_signal(&*MENU_ITEM_DISABLED_STYLE, signal.map(clone!(enabled => move |x| {
                enabled.set_neq(x);
                !x
            })))

            .event(move |_: events::Click| {
                if enabled.get() {
                    if !submenu {
                        menu_visible.set_neq(false);
                    }

                    on_click();
                }
            })

            .children(&mut [
                icon,

                if submenu {
                    // TODO figure out a way to avoid this wrapper div ?
                    html!("div", {
                        .class(&*STRETCH_STYLE)
                        .text(name)
                    })

                } else {
                    text(name)
                },

                if submenu {
                    html!("div", {
                        .class(&*MENU_CHEVRON_STYLE)
                    })

                } else {
                    Dom::empty()
                },
            ])
        });

        Child { dom }
    }

    pub(crate) fn action<S, F>(&self, name: &str, icon_url: Option<&str>, signal: S, on_click: F) -> Child
        where S: Signal<Item = bool> + 'static,
              F: FnMut() + 'static {

        self.action_(false, name, icon(icon_url), signal, on_click)
    }

    pub(crate) fn toggle<A, F>(&self, name: &str, signal: A, on_click: F) -> Child
        where A: Signal<Item = bool> + 'static,
              F: FnMut() + 'static {

        self.action_(
            false,
            name,
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
            always(true),
            on_click,
        )
    }

    pub(crate) fn multiselect<A, F>(&self, name: &str, signal: A, mut on_click: F) -> Child
        where A: Signal<Item = Option<bool>> + 'static,
              F: FnMut(Option<bool>) + 'static {

        let state = Mutable::new(Some(false));

        self.action_(
            false,
            name,
            html!("div", {
                .class(&*MENU_ICON_STYLE)

                .future(signal.for_each(clone!(state => move |x| {
                    state.set_neq(x);
                    async {}
                })))

                .children(&mut [
                    html!("img", {
                        .class(&*MENU_ICON_IMAGE_STYLE)
                        .visible_signal(state.signal().map(|x| x == Some(true)))
                        .attribute("src", "/icons/iconic/check.svg")
                        .attribute("alt", "")
                    }),

                    html!("img", {
                        .class(&*MENU_ICON_IMAGE_STYLE)
                        .visible_signal(state.signal().map(|x| x == None))
                        .attribute("src", "/icons/iconic/minus.svg")
                        .attribute("alt", "")
                    }),
                ])
            }),
            always(true),
            move || {
                on_click(state.get());
            },
        )
    }

    pub(crate) fn submenu<F>(&self, name: &str, icon_url: Option<&str>, f: F) -> Child
        where F: FnOnce(Parent) -> Vec<Child> {

        let parent_visible = self.visible.clone();

        let visible = Mutable::new(false);
        let back_hover = Mutable::new(false);

        let action = self.action_(true, name, icon(icon_url), always(true), clone!(parent_visible, visible => move || {
            parent_visible.set_neq(false);
            visible.set_neq(true);
        }));

        let this = Parent {
            menu_visible: self.menu_visible.clone(),
            visible: visible.clone(),
        };

        let separator = this.separator();

        let mut children: Vec<Dom> = f(this).into_iter().map(|x| x.dom).collect();

        children.insert(0, action.dom);

        children.insert(1, html!("div", {
            .class([
                &*CENTER_STYLE,
                &*SUBMENU_HEADER_STYLE,
            ])

            .visible_signal(visible.signal())

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

                    .event(clone!(back_hover => move |_: events::MouseLeave| {
                        back_hover.set_neq(false);
                    }))

                    .event(clone!(visible => move |_: events::Click| {
                        parent_visible.set_neq(true);
                        visible.set_neq(false);
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

        children.insert(2, separator.dom);

        let dom = html!("div", {
            .future(self.menu_visible.signal().for_each(move |x| {
                if !x {
                    visible.set_neq(false);
                    back_hover.set_neq(false);
                }

                async {}
            }))

            .children(&mut children)
        });

        Child { dom }
    }

    pub(crate) fn children_signal_vec<S, F>(&self, f: F) -> Child
        where F: FnOnce(Parent) -> S,
              S: SignalVec<Item = Child> + 'static {

        let parent = Parent {
            menu_visible: self.menu_visible.clone(),
            visible: self.visible.clone(),
        };

        let signal = f(parent);

        let dom = html!("div", {
            .children_signal_vec(signal.map(|x| x.dom))
        });

        Child { dom }
    }
}


#[derive(Debug)]
pub(crate) struct Child {
    dom: Dom,
}


// TODO verify that there aren't any Arc cycles
#[derive(Debug)]
pub(crate) struct Menu {
    menu_visible: Mutable<bool>,
}

impl Menu {
    pub(crate) fn new() -> Self {
        Self {
            menu_visible: Mutable::new(false),
        }
    }

    pub(crate) fn show(&self) {
        self.menu_visible.set_neq(true);
    }

    pub(crate) fn is_showing(&self) -> impl Signal<Item = bool> {
        self.menu_visible.signal()
    }

    pub(crate) fn render<F>(&self, f: F) -> Dom where F: FnOnce(Parent) -> Vec<Child> {
        let menu_visible = self.menu_visible.clone();

        let visible = Mutable::new(false);

        let parent = Parent {
            menu_visible: menu_visible.clone(),
            visible: visible.clone(),
        };

        let mut children: Vec<Dom> = f(parent).into_iter().map(|x| x.dom).collect();

        html!("div", {
            .class(&*TOP_STYLE)

            .visible_signal(self.menu_visible.signal())

            .children(&mut [
                html!("div", {
                    .class([
                        &*MODAL_STYLE,
                        &*MENU_MODAL_STYLE,
                    ])

                    .event(clone!(menu_visible => move |_: events::Click| {
                        menu_visible.set_neq(false);
                    }))

                    .event(move |_: events::ContextMenu| {
                        menu_visible.set_neq(false);
                    })
                }),

                html!("div", {
                    .class(&*MENU_STYLE)

                    // TODO is there a better way of doing this ?
                    .future(self.menu_visible.signal().for_each(move |x| {
                        visible.set_neq(x);
                        async {}
                    }))

                    .children(&mut children)
                }),

                html!("div", {
                    .class(&*MENU_ARROW_STYLE)
                }),
            ])
        })
    }
}
