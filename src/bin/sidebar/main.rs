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
use dominator::events::MouseOverEvent;
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


struct Dragging {
    tab_index: Option<usize>,
}

struct State {
    tabs: MutableVec<Rc<Tab>>,
    dragging: Mutable<Option<Dragging>>,
}

impl State {
    fn with_dragging_indexes<A, F, D>(&self, id: usize, f: F, default: D) -> A
        where F: FnOnce(&[Rc<Tab>], usize, usize) -> A,
              D: FnOnce() -> A {

        self.dragging.with_ref(|dragging| {
            if let Some(dragging) = dragging {
                self.tabs.with_slice(|slice| {
                    // The index of the tab which is being dragged
                    let mut old_index = None;

                    // The index of the tab which has the id `id`
                    let mut new_index = None;

                    let old_index = dragging.tab_index.unwrap_or_else(|| slice.len());
                    let new_index = slice.iter().position(|tab| tab.id == id).unwrap();

                    for (index, tab) in slice.iter().enumerate() {
                        let old_done = if let None = old_index {
                            if dragging.tab.map(|id| tab.id == id).unwrap_or(false) {
                                old_index = Some(index);
                                true
                            } else {
                                false
                            }
                        } else {
                            true
                        };

                        let new_done = if let None = new_index {
                            if tab.id == id {
                                new_index = Some(index);
                                true
                            } else {
                                false
                            }
                        } else {
                            true
                        };

                        if old_done && new_done {
                            break;
                        }
                    }

                    let old_index = old_index.unwrap_or_else(|| slice.len());
                    let new_index = new_index.unwrap();

                    f(slice, old_index, new_index)
                })

            } else {
                default()
            }
        })
    }

    fn should_be_dragging(&self, id: usize) -> bool {
        self.with_dragging_indexes(id, |_slice, old_index, new_index| {
            new_index > old_index
        }, || false)
    }

    fn get_dragging(&self, id: usize) -> Dragging {
        self.with_dragging_indexes(id, |slice, old_index, new_index| {
            if old_index <= new_index {
                let new_index = new_index + 1;

                if new_index < slice.len() {
                    Dragging {
                        tab: Some(slice[new_index].id),
                    }

                } else {
                    Dragging {
                        tab: None,
                    }
                }

            } else {
                Dragging {
                    tab: Some(id),
                }
            }

        }, || {
            Dragging {
                tab: Some(id),
            }
        })
    }

    fn update_dragging_tabs(&self, tab: Option<usize>) {
        self.tabs.with_slice(|slice| {
            if let Some(id) = tab {
                let mut seen = false;

                for tab in slice.iter() {
                    if tab.id == id {
                        seen = true;
                        tab.drag_over.animate_to(Percentage::new(1.0));

                    } else if seen {
                        tab.drag_over.animate_to(Percentage::new(1.0));

                    } else {
                        tab.drag_over.animate_to(Percentage::new(0.0));
                    }
                }

            } else {
                for tab in slice.iter() {
                    tab.drag_over.animate_to(Percentage::new(0.0));
                }
            }
        });
    }

    fn drag_over(&self, id: usize) {
        let dragging = self.get_dragging(id);

        let tab = dragging.tab;

        self.dragging.set(Some(dragging));

        self.update_dragging_tabs(tab);
    }
}


fn main() {
    let state = Rc::new(State {
        tabs: MutableVec::new_with_values((0..5000).map(|id| {
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
        })}, 550);
    }

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
    };

    let tab_text_style = class! {
        style("padding-left", "3px");
        style("padding-right", "1px");
    };

    log!("Starting");

    dominator::append_dom(&dominator::body(),
        html!("div", {
            class(&group_style);

            style_signal("padding-bottom", state.dragging.signal_map(|dragging| {
                if dragging.is_some() {
                    Some("25px")

                } else {
                    None
                }
            }));

            children_signal_vec(state.tabs.signal_vec_cloned().animated_map(500.0, move |tab, height| {
                if state.should_be_dragging(tab.id) {
                    tab.drag_over.jump_to(Percentage::new(1.0));
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

                    event(clone!(state => move |_: MouseOverEvent| {
                        state.drag_over(tab.id);
                    }));
                })
            }));
        }),
    );

    log!("Finished");
}
