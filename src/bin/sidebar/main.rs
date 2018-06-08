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
use dominator::animation::{Percentage, MutableAnimation};
use dominator::animation::easing;
use dominator::events::MouseOverEvent;
use futures_signals::signal::{Mutable, SignalExt};
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
    tab: Option<usize>,
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
        tabs: MutableVec::new_with_values((0..5).map(|id| {
            Rc::new(Tab::new(id, "foo", "foo"))
        }).collect()),
        dragging: Mutable::new(None),
    });

    let mut top_id = 5;

    js! { @(no_return)
        setInterval(@{clone!(state => move || {
            state.tabs.insert_cloned(0, Rc::new(Tab::new(top_id, "foo", "foo")));
            top_id += 1;
        })}, 1000);
    }

    let group_style = class! {
        style("border", "1px solid black");
        style("overflow", "hidden");
    };

    let tab_style = class! {
        style("box-sizing", "border-box");
        style("position", "relative");
        style("background-color", "white");
        style("border", "1px solid red");
        style("margin", "-1px");
        style("padding-left", "5px");
        style("padding-right", "5px");
        style("overflow", "hidden");
        style("height", "25px");
    };

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

            children_signal_vec(state.tabs.signal_vec_cloned().animated_map(300.0, move |tab, height| {
                if state.should_be_dragging(tab.id) {
                    tab.drag_over.jump_to(Percentage::new(1.0));
                }

                html!("div", {
                    class(&tab_style);

                    style_signal("margin-left", height.signal().map(|t| {
                        t.none_if(1.0).map(|t| format!("{}px", easing::in_out(t, easing::cubic).range_inclusive(20.0, -1.0)))
                    }));

                    style_signal("height", height.signal().map(|t| {
                        t.none_if(1.0).map(|t| format!("{}px", easing::in_out(t, easing::cubic).range_inclusive(0.0, 25.0)))
                    }));

                    style_signal("top", tab.drag_over.signal().map(|t| {
                        t.none_if(0.0).map(|t| format!("{}px", easing::in_out(t, easing::cubic).range_inclusive(0.0, 25.0)))
                    }));

                    children(&mut [
                        text(&tab.title)
                    ]);

                    event(clone!(state => move |_: MouseOverEvent| {
                        state.drag_over(tab.id);
                    }));
                })
            }));
        }),
    );
}
