extern crate futures_signals;
#[macro_use]
extern crate dominator;
#[macro_use]
extern crate tab_organizer;
#[macro_use]
extern crate stdweb;

use std::rc::Rc;
use dominator::traits::*;
use dominator::text;
use dominator::animation::{Percentage, MutableAnimation, AnimatedMapBroadcaster};
use dominator::animation::easing;
use dominator::events::{MouseDownEvent, MouseOverEvent, MouseMoveEvent, MouseUpEvent, IMouseEvent};
use futures_signals::signal::{Signal, Mutable, SignalExt};
use futures_signals::signal_vec::{MutableVec, SignalVecExt};


#[derive(Debug)]
struct Tab {
    id: usize,
    title: String,
    url: String,
    dragging: bool,
    drag_over: MutableAnimation,
}

impl Tab {
    fn new(id: usize, title: &str, url: &str) -> Self {
        Self {
            id,
            title: title.to_owned(),
            url: url.to_owned(),
            dragging: false,
            drag_over: MutableAnimation::new(125.0),
        }
    }
}


enum DragState {
    DragStart { x: i32, y: i32, tab_id: usize },
    // TODO maybe this should be usize rather than Option<usize>
    Dragging { tab_index: Option<usize> },
}

struct State {
    tabs: MutableVec<Rc<Tab>>,
    dragging: Mutable<Option<DragState>>,
}

impl State {
    fn get_dragging_index(&self) -> Option<usize> {
        self.dragging.with_ref(|dragging| {
            if let Some(DragState::Dragging { tab_index }) = dragging {
                Some(tab_index.unwrap_or_else(|| self.tabs.len()))

            } else {
                None
            }
        })
    }

    fn should_be_dragging(&self, new_index: usize) -> bool {
        self.get_dragging_index().map(|old_index| new_index > old_index).unwrap_or(false)
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

    fn drag_start(&self, x: i32, y: i32, tab_id: usize) {
        let is_dragging = self.dragging.with_ref(|dragging| dragging.is_some());

        if !is_dragging {
            self.dragging.set(Some(DragState::DragStart { x, y, tab_id }));
        }
    }

    fn drag_move(&self, new_x: i32, new_y: i32) {
        let tab_index = self.dragging.with_ref(|dragging| {
            if let Some(DragState::DragStart { x, y, tab_id }) = dragging {
                let x = (x - new_x) as f64;
                let y = (y - new_y) as f64;

                if x.hypot(y) > 5.0 {
                    let tab_id = *tab_id;
                    // TODO what if this is None ?
                    self.tabs.with_slice(|slice| slice.iter().position(|tab| tab.id == tab_id))

                } else {
                    None
                }

            } else {
                None
            }
        });

        if let Some(tab_index) = tab_index {
            let tab_index = Some(tab_index);

            self.dragging.set(Some(DragState::Dragging { tab_index }));

            self.update_dragging_tabs(tab_index, |tab, percentage| {
                tab.drag_over.jump_to(percentage);
            });
        }
    }

    fn drag_over(&self, new_index: usize) {
        if let Some(old_index) = self.get_dragging_index() {
            let tab_index = if old_index <= new_index {
                let new_index = new_index + 1;

                if new_index < self.tabs.len() {
                    Some(new_index)

                } else {
                    None
                }

            } else {
                Some(new_index)
            };

            self.dragging.set(Some(DragState::Dragging { tab_index }));

            self.update_dragging_tabs(tab_index, |tab, percentage| {
                tab.drag_over.animate_to(percentage);
            });
        }
    }

    fn drag_end(&self) {
        self.dragging.set(None);

        self.tabs.with_slice(|slice| {
            for tab in slice.iter() {
                tab.drag_over.jump_to(Percentage::new(0.0));
            }
        });
    }
}


fn main() {
    let state = Rc::new(State {
        tabs: MutableVec::new_with_values((0..10).map(|id| {
            Rc::new(Tab::new(id, "foo", "foo"))
        }).collect()),
        dragging: Mutable::new(None),
    });

    let mut top_id = 999999;

    js! { @(no_return)
        setInterval(@{clone!(state => move || {
            state.tabs.remove(0);
            state.tabs.insert_cloned(0, Rc::new(Tab::new(top_id, "foo", "foo")));

            top_id += 1;

            state.tabs.pop().unwrap();
            state.tabs.push_cloned(Rc::new(Tab::new(top_id, "foo", "foo")));

            top_id += 1;
        })}, 550);
    }

    stylesheet!("html, body", {
        style("-moz-user-select", "none");

        style_signal("cursor", state.dragging.signal_map(|dragging| {
            if let Some(DragState::Dragging { .. }) = dragging {
                Some("grabbing")

            } else {
                None
            }
        }));
    });

    let group_style = class! {
        style("border", "1px solid black");
        style("overflow", "hidden");
    };

    let tab_style = class! {
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
        //style("transform", "translate3d(0px, 0px, 0px)");

        style_signal("cursor", state.dragging.signal_map(|dragging| {
            if let Some(DragState::Dragging { .. }) = dragging {
                None

            } else {
                Some("pointer")
            }
        }));
    };

    let tab_text_style = class! {
        style("padding-left", "3px");
        style("padding-right", "1px");
    };

    log!("Starting");

    dominator::append_dom(&dominator::body(),
        html!("div", {
            // TODO only attach this when dragging
            global_event(clone!(state => move |_: MouseUpEvent| {
                state.drag_end();
            }));


            class(&group_style);

            style_signal("padding-bottom", state.dragging.signal_map(|dragging| {
                if let Some(DragState::Dragging { .. }) = dragging {
                    Some("25px")

                } else {
                    None
                }
            }));

            children_signal_vec(state.tabs.signal_vec_cloned().enumerate().animated_map(500.0, move |(index, tab), height| {
                if let Some(index) = index.get() {
                    if state.should_be_dragging(index) {
                        tab.drag_over.jump_to(Percentage::new(1.0));
                    }
                }

                fn px(t: Option<Percentage>, min: f64, max: f64) -> Option<String> {
                    t.map(|t| format!("{}px", easing::in_out(t, easing::cubic).range_inclusive(min, max).round()))
                }

                fn height_signal(height: &AnimatedMapBroadcaster, min: f64, max: f64) -> impl Signal<Item = Option<String>> {
                    height.signal().map(move |t| px(t.none_if(1.0), min, max))
                }

                html!("div", {
                    class(&tab_style);

                    style_signal("margin-left", height_signal(&height, 12.0, 0.0));
                    style_signal("height", height_signal(&height, 0.0, 20.0));
                    style_signal("padding-top", height_signal(&height, 0.0, 1.0));
                    style_signal("padding-bottom", height_signal(&height, 0.0, 1.0));
                    style_signal("border-top-width", height_signal(&height, 0.0, 1.0));
                    style_signal("border-bottom-width", height_signal(&height, 0.0, 1.0));

                    style_signal("opacity", height.signal().map(|t| {
                        t.none_if(1.0).map(|t| easing::in_out(t, easing::cubic).range_inclusive(0.0, 1.0).to_string())
                    }));

                    style_signal("top", tab.drag_over.signal().map(|t| px(t.none_if(0.0), 0.0, 20.0)));

                    //style_signal("transform", tab.drag_over.signal().map(|t| t.none_if(0.0).map(|t| format!("translate3d(0px, {}px, 0px)", easing::in_out(t, easing::cubic).range_inclusive(0.0, 20.0).round()))));

                    children(&mut [
                        html!("div", {
                            class(&tab_text_style);

                            style_signal("transform", height.signal().map(|t| {
                                t.none_if(1.0).map(|t| format!("rotateX({}deg)", easing::in_out(t, easing::cubic).range_inclusive(-90.0, 0.0)))
                            }));

                            children(&mut [
                                text(&tab.title)
                            ]);
                        }),
                    ]);

                    event(clone!(state, index => move |_: MouseOverEvent| {
                        if let Some(index) = index.get() {
                            state.drag_over(index);
                        }
                    }));

                    event(clone!(state, index => move |e: MouseDownEvent| {
                        if let Some(_) = index.get() {
                            state.drag_start(e.client_x(), e.client_y(), tab.id);
                        }
                    }));

                    // TODO only attach this when dragging
                    global_event(clone!(state => move |e: MouseMoveEvent| {
                        state.drag_move(e.client_x(), e.client_y());
                    }));
                })
            }));
        }),
    );

    log!("Finished");
}
