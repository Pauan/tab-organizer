extern crate futures_signals;
#[macro_use]
extern crate dominator;
#[macro_use]
extern crate tab_organizer;
#[macro_use]
extern crate stdweb;
#[macro_use]
extern crate lazy_static;

use std::sync::Arc;
use dominator::traits::*;
use dominator::{Dom, text_signal, HIGHEST_ZINDEX, DerefFn};
use dominator::animation::{Percentage, MutableAnimation, AnimatedMapBroadcaster};
use dominator::animation::easing;
use dominator::events::{MouseDownEvent, MouseOverEvent, MouseMoveEvent, MouseUpEvent, MouseButton, IMouseEvent};
use stdweb::web::{HtmlElement, Rect, IHtmlElement};
use futures_signals::signal::{Signal, Mutable, SignalExt};
use futures_signals::signal_vec::{MutableVec, SignalVecExt};


struct Group {
    id: usize,
    tabs: MutableVec<Arc<Tab>>,
    drag_over: MutableAnimation,
}

impl Group {
    fn new(id: usize, tabs: Vec<Arc<Tab>>) -> Self {
        Self {
            id,
            tabs: MutableVec::new_with_values(tabs),
            drag_over: MutableAnimation::new(125.0),
        }
    }

    fn tabs_each<F>(&self, mut f: F) where F: FnMut(&Tab) {
        self.tabs.with_slice(|slice| {
            for tab in slice.iter() {
                f(&tab);
            }
        });
    }

    fn update_dragging_tabs<F>(&self, tab_index: Option<usize>, mut f: F) where F: FnMut(&Tab, Percentage) {
        self.tabs.with_slice(|slice| {
            if let Some(tab_index) = tab_index {
                let mut seen = false;

                for (index, tab) in slice.iter().enumerate() {
                    if index == tab_index {
                        seen = true;
                        f(&tab, Percentage::new(1.0));

                    } else if seen {
                        f(&tab, Percentage::new(1.0));

                    } else {
                        f(&tab, Percentage::new(0.0));
                    }
                }

            } else {
                for tab in slice.iter() {
                    f(&tab, Percentage::new(0.0));
                }
            }
        });
    }
}


struct Tab {
    id: usize,
    favicon_url: Mutable<Option<Arc<String>>>,
    title: Mutable<Option<Arc<String>>>,
    url: Mutable<Option<Arc<String>>>,
    selected: Mutable<bool>,
    dragging: Mutable<bool>,
    drag_over: MutableAnimation,
}

impl Tab {
    fn new(id: usize, title: &str, url: &str) -> Self {
        Self {
            id,
            favicon_url: Mutable::new(None),
            title: Mutable::new(Some(Arc::new(title.to_owned()))),
            url: Mutable::new(Some(Arc::new(url.to_owned()))),
            selected: Mutable::new(false),
            dragging: Mutable::new(false),
            drag_over: MutableAnimation::new(125.0),
        }
    }

    fn toggle_selected(&self) {
        self.selected.replace_with(|selected| !*selected);
    }
}


enum DragState {
    DragStart {
        mouse_x: i32,
        mouse_y: i32,
        rect: Rect,
        group: Arc<Group>,
        tab: Arc<Tab>,
        tab_index: usize,
    },

    // TODO maybe this should be usize rather than Option<usize>
    Dragging {
        mouse_x: i32,
        mouse_y: i32,
        rect: Rect,
        group: Arc<Group>,
        tab_index: Option<usize>,
    },
}


struct Dragging {
    state: Mutable<Option<DragState>>,
    selected_tabs: Mutable<Vec<Arc<Tab>>>,
    selected_tabs_animation: MutableAnimation,
}

impl Dragging {
    fn new() -> Self {
        Self {
            state: Mutable::new(None),
            selected_tabs: Mutable::new(vec![]),
            selected_tabs_animation: MutableAnimation::new(300.0),
        }
    }
}


struct State {
    groups: MutableVec<Arc<Group>>,
    dragging: Dragging,
}

impl State {
    fn get_dragging_index(&self) -> Option<usize> {
        let dragging = self.dragging.state.lock_ref();

        if let Some(DragState::Dragging { ref group, tab_index, .. }) = *dragging {
            Some(tab_index.unwrap_or_else(|| group.tabs.len()))

        } else {
            None
        }
    }

    fn should_be_dragging(&self, new_index: usize) -> bool {
        self.get_dragging_index().map(|old_index| new_index > old_index).unwrap_or(false)
    }

    fn drag_start(&self, mouse_x: i32, mouse_y: i32, rect: Rect, group: Arc<Group>, tab: Arc<Tab>, tab_index: usize) {
        let mut dragging = self.dragging.state.lock_mut();

        if dragging.is_none() {
            *dragging = Some(DragState::DragStart { mouse_x, mouse_y, rect, group, tab, tab_index });
        }
    }

    fn drag_move(&self, new_x: i32, new_y: i32) {
        let mut dragging = self.dragging.state.lock_mut();

        let new_dragging = match *dragging {
            Some(DragState::DragStart { mouse_x, mouse_y, ref rect, ref group, ref tab, tab_index }) => {
                let mouse_x = (mouse_x - new_x) as f64;
                let mouse_y = (mouse_y - new_y) as f64;

                if mouse_x.hypot(mouse_y) > 5.0 {
                    let tab_index = Some(tab_index);

                    let selected_tabs: Vec<Arc<Tab>> = if tab.selected.get() {
                        group.tabs.with_slice(|tabs| {
                            tabs.iter()
                                .filter(|x| x.selected.get())
                                .cloned()
                                .collect()
                        })

                    } else {
                        vec![tab.clone()]
                    };

                    if selected_tabs.len() != 0 {
                        group.drag_over.jump_to(Percentage::new(1.0));

                        group.update_dragging_tabs(tab_index, |tab, percentage| {
                            tab.drag_over.jump_to(percentage);
                        });

                        for tab in selected_tabs.iter() {
                            tab.dragging.set(true);
                        }

                        self.dragging.selected_tabs.set(selected_tabs);

                        Some(DragState::Dragging { mouse_x: new_x, mouse_y: new_y, rect: rect.clone(), group: group.clone(), tab_index })

                    } else {
                        None
                    }

                } else {
                    None
                }
            },

            Some(DragState::Dragging { ref mut mouse_x, ref mut mouse_y, .. }) => {
                *mouse_x = new_x;
                *mouse_y = new_y;
                None
            },

            None => None,
        };

        if new_dragging.is_some() {
            *dragging = new_dragging;
        }
    }

    fn drag_over(&self, new_rect: Rect, new_group: Arc<Group>, new_index: usize) {
        let mut dragging = self.dragging.state.lock_mut();

        // TODO verify that this doesn't notify if it isn't dragging
        if let Some(DragState::Dragging { ref mut group, ref mut tab_index, ref mut rect, .. }) = *dragging {
            if new_group.id == group.id {
                // TODO code duplication with get_dragging_index
                let old_index = tab_index.unwrap_or_else(|| group.tabs.len());

                let new_tab_index = if old_index <= new_index {
                    let new_index = new_index + 1;

                    if new_index < group.tabs.len() {
                        Some(new_index)

                    } else {
                        None
                    }

                } else {
                    Some(new_index)
                };

                group.update_dragging_tabs(new_tab_index, |tab, percentage| {
                    tab.drag_over.animate_to(percentage);
                });

                *tab_index = new_tab_index;

            } else {
                self.groups.with_slice(|groups| {
                    // TODO gross, improve this
                    let old_group_index = groups.iter().position(|x| x.id == group.id).unwrap();
                    let new_group_index = groups.iter().position(|x| x.id == new_group.id).unwrap();

                    let new_tab_index = if new_index == (new_group.tabs.len() - 1) {
                        None

                    } else if old_group_index <= new_group_index {
                        let new_index = new_index + 1;

                        if new_index < new_group.tabs.len() {
                            Some(new_index)

                        } else {
                            None
                        }

                    } else {
                        Some(new_index)
                    };

                    group.drag_over.animate_to(Percentage::new(0.0));
                    new_group.drag_over.animate_to(Percentage::new(1.0));

                    group.tabs_each(|tab| {
                        tab.drag_over.animate_to(Percentage::new(0.0));
                    });

                    new_group.update_dragging_tabs(new_tab_index, |tab, percentage| {
                        tab.drag_over.animate_to(percentage);
                    });

                    *group = new_group;
                    *tab_index = new_tab_index;
                });
            }

            *rect = new_rect;
        }
    }

    fn drag_end(&self) {
        let mut dragging = self.dragging.state.lock_mut();
        let mut selected_tabs = self.dragging.selected_tabs.lock_mut();

        if let Some(DragState::Dragging { ref group, .. }) = *dragging {
            group.drag_over.jump_to(Percentage::new(0.0));

            group.tabs_each(|tab| {
                tab.drag_over.jump_to(Percentage::new(0.0));
            });
        }

        if dragging.is_some() {
            *dragging = None;
        }

        if selected_tabs.len() != 0 {
            for tab in selected_tabs.iter() {
                tab.dragging.set(false);
            }

            *selected_tabs = vec![];
        }
    }
}


lazy_static! {
    static ref STATE: Arc<State> = Arc::new(State {
        groups: MutableVec::new_with_values((0..3).map(|id| {
            Arc::new(Group::new(id, (0..10).map(|id| {
                Arc::new(Tab::new(id, "foo", "foo"))
            }).collect()))
        }).collect()),

        dragging: Dragging::new(),
    });

    static ref GROUP_STYLE: String = class! {
        style("border", "1px solid black");
        style("overflow", "hidden");
    };

    static ref TAB_STYLE: String = class! {
        style("cursor", "pointer");
        style("display", "flex");
        style("box-sizing", "border-box");
        style("position", "relative");
        style("background-color", "white");
        style("border", "1px solid transparent");
        style("padding", "1px");
        style("overflow", "hidden");
        style("border-radius", "5px");
        style("height", "20px");

        style_signal("cursor", STATE.dragging.state.signal_ref(|dragging| {
            if let Some(DragState::Dragging { .. }) = dragging {
                None

            } else {
                Some("pointer")
            }
        }));
    };

    static ref TAB_SHADOW_STYLE: String = class! {
        style("box-shadow", "      1px 1px  1px hsla(0, 0%,   0%, 0.25),
                             inset 0px 0px  3px hsla(0, 0%, 100%, 1   ),
                             inset 0px 0px 10px hsla(0, 0%, 100%, 0.25)");
    };

    static ref TAB_SELECTED_STYLE: String = class! {
        style("background-color", "hsl(100, 78%, 80%)");
        style("border-color", "hsl(100, 50%, 55%) hsl(100, 50%, 50%) hsl(100, 50%, 45%) hsl(100, 50%, 50%)");
    };

    static ref TAB_TEXT_STYLE: String = class! {
        style("padding-left", "3px");
        style("padding-right", "1px");
    };

    static ref TAB_DRAGGING_STYLE: String = class! {
        style("position", "fixed");
        style("left", "0px");
        style("top", "0px");
        style("overflow", "visible");
        style("pointer-events", "none");
        style("opacity", "0.98");
        style("z-index", HIGHEST_ZINDEX);
    };
}


fn option_str(x: Option<Arc<String>>) -> Option<DerefFn<Arc<String>, impl Fn(&Arc<String>) -> &str>> {
    x.map(|x| DerefFn::new(x, move |x| x.as_str()))
}

fn option_str_default(x: Option<Arc<String>>, default: &'static str) -> DerefFn<Option<Arc<String>>, impl Fn(&Option<Arc<String>>) -> &str> {
    DerefFn::new(x, move |x| {
        x.as_ref().map(|x| x.as_str()).unwrap_or(default)
    })
}


fn main() {
    /*let mut top_id = 999999;

    js! { @(no_return)
        setInterval(@{move || {
            STATE.tabs.remove(0);
            STATE.tabs.insert_cloned(0, Arc::new(Tab::new(top_id, "foo", "foo")));

            top_id += 1;

            STATE.tabs.pop().unwrap();
            STATE.tabs.push_cloned(Arc::new(Tab::new(top_id, "foo", "foo")));

            top_id += 1;
        }}, 550);
    }*/

    stylesheet!("html, body", {
        style("-moz-user-select", "none");

        style_signal("cursor", STATE.dragging.state.signal_ref(|dragging| {
            if let Some(DragState::Dragging { .. }) = dragging {
                Some("grabbing")

            } else {
                None
            }
        }));
    });

    log!("Starting");

    fn px(t: Option<Percentage>, min: f64, max: f64) -> Option<String> {
        t.map(|t| format!("{}px", easing::in_out(t, easing::cubic).range_inclusive(min, max).round()))
    }

    dominator::append_dom(&dominator::body(),
        html!("div", {
            // TODO only attach this when dragging
            global_event(move |_: MouseUpEvent| {
                STATE.drag_end();
            });

            // TODO only attach this when dragging
            global_event(move |e: MouseMoveEvent| {
                STATE.drag_move(e.client_x(), e.client_y());
            });

            children(&mut [
                html!("div", {
                    class(&TAB_DRAGGING_STYLE);

                    style_signal("display", STATE.dragging.state.signal_ref(|dragging| {
                        if let Some(DragState::Dragging { .. }) = dragging {
                            None

                        } else {
                            Some("none")
                        }
                    }));

                    style_signal("width", STATE.dragging.state.signal_ref(|dragging| {
                        if let Some(DragState::Dragging { rect, .. }) = dragging {
                            Some(format!("{}px", rect.get_width().round()))

                        } else {
                            None
                        }
                    }));

                    style_signal("transform", STATE.dragging.state.signal_ref(|dragging| {
                        if let Some(DragState::Dragging { mouse_y, rect, .. }) = dragging {
                            Some(format!("translate({}px, {}px)", rect.get_left().round(), (mouse_y - 11)))

                        } else {
                            None
                        }
                    }));

                    children_signal_vec(STATE.dragging.selected_tabs.signal_ref(|tabs| {
                        tabs.iter().enumerate().map(|(index, tab)| {
                            // TODO use some sort of oneshot animation instead
                            let animation = MutableAnimation::new(150.0);

                            animation.animate_to(Percentage::new(1.0));

                            Dom::with_state(animation, |animation| {
                                html!("div", {
                                    class(&TAB_STYLE);
                                    class(&TAB_SELECTED_STYLE);
                                    class(&TAB_SHADOW_STYLE);

                                    style("z-index", &format!("-{}", index));

                                    // TODO use ease-out easing
                                    style_signal("margin-top", animation.signal().map(move |t| {
                                        if index == 0 {
                                            None

                                        } else if index < 5 {
                                            px(t.none_if(0.0), 0.0, -18.0)

                                        } else {
                                            px(t.none_if(0.0), 0.0, -20.0)
                                        }
                                    }));

                                    // TODO use ease-out easing
                                    style_signal("opacity", animation.signal().map(move |t| {
                                        if index < 5 {
                                            None

                                        } else {
                                            px(t.none_if(0.0), 1.0, 0.0)
                                        }
                                    }));

                                    children(&mut [
                                        html!("div", {
                                            class(&TAB_TEXT_STYLE);

                                            children(&mut [
                                                text_signal(tab.title.signal_cloned().map(|x| option_str_default(x, ""))),
                                            ]);
                                        }),
                                    ]);
                                })
                            })
                        }).collect()
                    }).to_signal_vec());
                }),

                html!("div", {
                    children_signal_vec(STATE.groups.signal_vec_cloned().animated_map(500.0, move |group, height| {
                        html!("div", {
                            class(&GROUP_STYLE);

                            style_signal("padding-bottom", group.drag_over.signal().map(move |t| px(t.none_if(0.0), 0.0, 20.0)));

                            /*map_ref! {
                                let drag_over = group.drag_over.signal(),
                                let is_dragging = STATE.dragging.signal_ref(move |dragging| {
                                    if let Some(DragState::Dragging { group, .. }) = dragging {
                                        group.id == id

                                    } else {
                                        false
                                    }
                                }) => {

                                    if *is_dragging {
                                        Some("25px")

                                    } else {
                                        None
                                    }
                                }
                            });*/

                            children_signal_vec(group.tabs.signal_vec_cloned().enumerate().animated_map(500.0, move |(index, tab), height| {
                                if let Some(index) = index.get() {
                                    if STATE.should_be_dragging(index) {
                                        tab.drag_over.jump_to(Percentage::new(1.0));
                                    }
                                }

                                fn height_signal(height: &AnimatedMapBroadcaster, min: f64, max: f64) -> impl Signal<Item = Option<String>> {
                                    height.signal().map(move |t| px(t.none_if(1.0), min, max))
                                }

                                html!("div", {
                                    class(&TAB_STYLE);

                                    class_signal(&TAB_SELECTED_STYLE, tab.selected.signal());

                                    style_signal("margin-left", height_signal(&height, 12.0, 0.0));
                                    style_signal("height", height_signal(&height, 0.0, 20.0));
                                    style_signal("padding-top", height_signal(&height, 0.0, 1.0));
                                    style_signal("padding-bottom", height_signal(&height, 0.0, 1.0));
                                    style_signal("border-top-width", height_signal(&height, 0.0, 1.0));
                                    style_signal("border-bottom-width", height_signal(&height, 0.0, 1.0));

                                    style_signal("display", tab.dragging.signal().map(|is_dragging| {
                                        if is_dragging {
                                            Some("none")

                                        } else {
                                            None
                                        }
                                    }));

                                    style_signal("opacity", height.signal().map(|t| {
                                        t.none_if(1.0).map(|t| easing::in_out(t, easing::cubic).range_inclusive(0.0, 1.0).to_string())
                                    }));

                                    style_signal("top", tab.drag_over.signal().map(|t| px(t.none_if(0.0), 0.0, 20.0)));

                                    children(&mut [
                                        html!("img", {
                                            attribute_signal("src", tab.favicon_url.signal_cloned().map(option_str));
                                        }),

                                        html!("div", {
                                            class(&TAB_TEXT_STYLE);

                                            style_signal("transform", height.signal().map(|t| {
                                                t.none_if(1.0).map(|t| format!("rotateX({}deg)", easing::in_out(t, easing::cubic).range_inclusive(-90.0, 0.0)))
                                            }));

                                            children(&mut [
                                                text_signal(tab.title.signal_cloned().map(|x| option_str_default(x, ""))),
                                            ]);
                                        }),
                                    ]);

                                    // TODO hacky
                                    with_element(|dom, element: HtmlElement| {
                                        dom
                                            .event(clone!(index, group, element => move |_: MouseOverEvent| {
                                                if let Some(index) = index.get() {
                                                    let rect = element.get_bounding_client_rect();
                                                    STATE.drag_over(rect, group.clone(), index);
                                                }
                                            }))
                                            .event(clone!(index, group, tab => move |e: MouseDownEvent| {
                                                if let Some(index) = index.get() {
                                                    let rect = element.get_bounding_client_rect();
                                                    console!(log, &rect);
                                                    STATE.drag_start(e.client_x(), e.client_y(), rect, group.clone(), tab.clone(), index);
                                                }
                                            }))
                                    });

                                    // TODO replace with MouseClickEvent
                                    event(clone!(index, tab => move |e: MouseUpEvent| {
                                        if index.get().is_some() {
                                            let shift = e.shift_key();
                                            // TODO is this correct ?
                                            // TODO test this, especially on Mac
                                            // TODO what if both of these are true ?
                                            let ctrl = e.ctrl_key() || e.meta_key();
                                            let alt = e.alt_key();

                                            match e.button() {
                                                MouseButton::Left => if ctrl && !shift && !alt {
                                                    tab.toggle_selected();
                                                },
                                                _ => {},
                                            }
                                        }
                                    }));
                                })
                            }));
                        })
                    }));
                }),
            ]);
        }),
    );

    log!("Finished");
}
