#![warn(unreachable_pub)]

extern crate futures;
#[macro_use]
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
use tab_organizer::{and, or, not};
use dominator::traits::*;
use dominator::{Dom, DomBuilder, text_signal, HIGHEST_ZINDEX, DerefFn};
use dominator::animation::{Percentage, MutableAnimation};
use dominator::animation::easing;
use dominator::events::{MouseDownEvent, MouseOverEvent, MouseOutEvent, MouseMoveEvent, MouseUpEvent, MouseButton, IMouseEvent};
use stdweb::web::{HtmlElement, Rect, IHtmlElement};
use futures::{Future, Never};
use futures::future::FutureExt;
use futures_signals::signal::{Signal, Mutable, SignalExt};
use futures_signals::signal_vec::{MutableVec, SignalVecExt};


const INSERT_ANIMATION_DURATION: f64 = 500.0; // 500.0
const DRAG_ANIMATION_DURATION: f64 = 100.0;
const TAB_HEIGHT: f64 = 20.0;
const DRAG_GAP_PX: f64 = 32.0;
const INSERT_LEFT_MARGIN: f64 = 12.0;


struct Group {
    id: usize,
    name: Mutable<Option<Arc<String>>>,
    tabs: MutableVec<Arc<Tab>>,
    drag_over: MutableAnimation,
    drag_top: MutableAnimation,
    insert_animation: MutableAnimation,
    last_selected_tab: Mutable<Option<Arc<Tab>>>,
}

impl Group {
    fn new(id: usize, tabs: Vec<Arc<Tab>>) -> Self {
        Self {
            id,
            name: Mutable::new(None),
            tabs: MutableVec::new_with_values(tabs),
            drag_over: MutableAnimation::new(DRAG_ANIMATION_DURATION),
            drag_top: MutableAnimation::new(DRAG_ANIMATION_DURATION),
            insert_animation: MutableAnimation::new_with_initial(INSERT_ANIMATION_DURATION, Percentage::new(1.0)),
            last_selected_tab: Mutable::new(None),
        }
    }

    fn new_animated(id: usize, tabs: Vec<Arc<Tab>>) -> Self {
        let group = Self::new(id, tabs);
        group.insert_animation.jump_to(Percentage::new(0.0));
        group.insert_animation.animate_to(Percentage::new(1.0));
        group
    }

    fn tabs_each<F>(&self, mut f: F) where F: FnMut(&Tab) {
        let slice = self.tabs.lock_slice();

        for tab in slice.iter() {
            f(&tab);
        }
    }

    fn update_dragging_tabs<F>(&self, tab_index: Option<usize>, mut f: F) where F: FnMut(&Tab, Percentage) {
        let slice = self.tabs.lock_slice();

        if let Some(tab_index) = tab_index {
            let mut seen = false;

            for (index, tab) in slice.iter().enumerate() {
                let percentage = if index == tab_index {
                    seen = true;
                    Percentage::new(1.0)

                } else if seen {
                    Percentage::new(1.0)

                } else {
                    Percentage::new(0.0)
                };

                f(&tab, percentage);
            }

        } else {
            for tab in slice.iter() {
                f(&tab, Percentage::new(0.0));
            }
        }
    }

    fn click_tab(&self, tab: &Tab) {
        {
            let tabs = self.tabs.lock_slice();

            for tab in tabs.iter() {
                tab.selected.set(false);
            }
        }

        self.last_selected_tab.set(None);
    }

    fn ctrl_select_tab(&self, tab: &Arc<Tab>) {
        let mut selected = tab.selected.lock_mut();

        *selected = !*selected;

        if *selected {
            self.last_selected_tab.set(Some(tab.clone()));

        } else {
            self.last_selected_tab.set(None);
        }
    }

    fn shift_select_tab(&self, tab: &Arc<Tab>) {
        let mut last_selected_tab = self.last_selected_tab.lock_mut();

        let selected = if let Some(ref last_selected_tab) = *last_selected_tab {
            let tabs = self.tabs.lock_slice();
            let mut seen = false;

            for x in tabs.iter() {
                if x.id == last_selected_tab.id ||
                   x.id == tab.id {
                    x.selected.set(true);

                    if tab.id != last_selected_tab.id {
                        seen = !seen;
                    }

                } else if seen {
                    x.selected.set(true);

                } else {
                    x.selected.set(false);
                }
            }

            true

        } else {
            false
        };

        if !selected {
            tab.selected.set(true);
            *last_selected_tab = Some(tab.clone());
        }
    }
}


struct Tab {
    id: usize,
    favicon_url: Mutable<Option<Arc<String>>>,
    title: Mutable<Option<Arc<String>>>,
    url: Mutable<Option<Arc<String>>>,
    unloaded: Mutable<bool>,
    selected: Mutable<bool>,
    dragging: Mutable<bool>,
    hovered: Mutable<bool>,
    drag_over: MutableAnimation,
    insert_animation: MutableAnimation,
}

impl Tab {
    fn new(id: usize, title: &str, url: &str) -> Self {
        Self {
            id,
            favicon_url: Mutable::new(None),
            title: Mutable::new(Some(Arc::new(title.to_owned()))),
            url: Mutable::new(Some(Arc::new(url.to_owned()))),
            unloaded: Mutable::new(true),
            selected: Mutable::new(false),
            dragging: Mutable::new(false),
            hovered: Mutable::new(false),
            drag_over: MutableAnimation::new(DRAG_ANIMATION_DURATION),
            insert_animation: MutableAnimation::new_with_initial(INSERT_ANIMATION_DURATION, Percentage::new(1.0)),
        }
    }

    fn new_animated(id: usize, title: &str, url: &str) -> Self {
        let tab = Self::new(id, title, url);
        tab.insert_animation.jump_to(Percentage::new(0.0));
        tab.insert_animation.animate_to(Percentage::new(1.0));
        tab
    }

    fn is_hovered(&self) -> impl Signal<Item = bool> {
        and(self.hovered.signal(), not(STATE.is_dragging()))
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
    fn update_dragging_groups<F>(&self, group_id: usize, mut f: F) where F: FnMut(&Group, Percentage) {
        let groups = self.groups.lock_slice();

        let mut seen = false;

        for x in groups.iter() {
            let percentage = if x.id == group_id {
                seen = true;
                Percentage::new(0.0)

            } else if seen {
                Percentage::new(1.0)

            } else {
                Percentage::new(0.0)
            };

            f(&x, percentage);
        }
    }

    fn get_dragging_index(&self, group_id: usize) -> Option<usize> {
        let dragging = self.dragging.state.lock_ref();

        if let Some(DragState::Dragging { ref group, tab_index, .. }) = *dragging {
            if group.id == group_id {
                Some(tab_index.unwrap_or_else(|| group.tabs.len()))

            } else {
                None
            }

        } else {
            None
        }
    }

    fn should_be_dragging_group(&self, new_index: usize) -> bool {
        let dragging = self.dragging.state.lock_ref();

        if let Some(DragState::Dragging { ref group, .. }) = *dragging {
            let groups = self.groups.lock_slice();

            let old_index = groups.iter().position(|x| x.id == group.id).unwrap_or_else(|| groups.len());

            new_index > old_index

        } else {
            false
        }
    }

    fn should_be_dragging_tab(&self, group_id: usize, new_index: usize) -> bool {
        self.get_dragging_index(group_id).map(|old_index| new_index > old_index).unwrap_or(false)
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
                        group.tabs.lock_slice().iter()
                            .filter(|x| x.selected.get())
                            .cloned()
                            .collect()

                    } else {
                        vec![tab.clone()]
                    };

                    if selected_tabs.len() != 0 {
                        group.drag_over.jump_to(Percentage::new(1.0));

                        self.update_dragging_groups(group.id, |group, percentage| {
                            group.drag_top.jump_to(percentage);
                        });

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

    fn drag_over(&self, new_group: Arc<Group>, new_index: usize) {
        let groups = self.groups.lock_slice();

        // TODO is this correct ?
        if let Some(new_group_index) = groups.iter().position(|x| x.id == new_group.id) {
            let mut dragging = self.dragging.state.lock_mut();

            // TODO verify that this doesn't notify if it isn't dragging
            if let Some(DragState::Dragging { ref mut group, ref mut tab_index, .. }) = *dragging {
                let new_tab_index = if new_group.id == group.id {
                    // TODO code duplication with get_dragging_index
                    let old_index = tab_index.unwrap_or_else(|| new_group.tabs.len());

                    if old_index <= new_index {
                        let new_index = new_index + 1;

                        if new_index < new_group.tabs.len() {
                            Some(new_index)

                        } else {
                            None
                        }

                    } else {
                        Some(new_index)
                    }

                } else {
                    group.drag_over.animate_to(Percentage::new(0.0));
                    new_group.drag_over.animate_to(Percentage::new(1.0));

                    self.update_dragging_groups(new_group.id, |group, percentage| {
                        group.drag_top.animate_to(percentage);
                    });

                    group.tabs_each(|tab| {
                        tab.drag_over.animate_to(Percentage::new(0.0));
                    });

                    let old_group_index = groups.iter().position(|x| x.id == group.id).unwrap_or_else(|| groups.len());

                    if new_index == (new_group.tabs.len() - 1) {
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
                    }
                };

                new_group.update_dragging_tabs(new_tab_index, |tab, percentage| {
                    tab.drag_over.animate_to(percentage);
                });

                *group = new_group;
                *tab_index = new_tab_index;
            }
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

            let groups = self.groups.lock_slice();

            for group in groups.iter() {
                group.drag_top.jump_to(Percentage::new(0.0));
            }

            if groups.iter().any(|x| x.id == group.id) {
                self.drag_tabs_to(&group, &**selected_tabs);
            }
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

    fn drag_tabs_to(&self, group: &Group, tabs: &[Arc<Tab>]) {

    }

    fn is_dragging(&self) -> impl Signal<Item = bool> {
        self.dragging.state.signal_ref(|dragging| {
            if let Some(DragState::Dragging { .. }) = dragging {
                true

            } else {
                false
            }
        })
    }

    /*fn is_dragging_group(&self, group_id: usize) -> impl Signal<Item = bool> {
        self.dragging.state.signal_ref(move |dragging| {
            if let Some(DragState::Dragging { group, .. }) = dragging {
                group.id == group_id

            } else {
                false
            }
        })
    }*/
}


lazy_static! {
    static ref STATE: Arc<State> = Arc::new(State {
        groups: MutableVec::new_with_values((0..3).map(|id| {
            Arc::new(Group::new(id, (0..10).map(|id| {
                Arc::new(Tab::new(id, "Foo", "Bar"))
            }).collect()))
        }).collect()),

        dragging: Dragging::new(),
    });

    static ref TOP_STYLE: String = class! {
        style("font-family", "sans-serif");
        style("font-size", "13px");
        style("width", "100%");
        style("height", "100%");
        style("padding-top", "2px");
        style("background-color", "hsl(0, 0%, 100%)");
    };

    static ref TEXTURE_STYLE: String = class! {
        style("background-image", "repeating-linear-gradient(0deg, \
                                       transparent                0px, \
                                       hsla(200, 30%, 30%, 0.022) 2px, \
                                       hsla(200, 30%, 30%, 0.022) 3px)");
    };

    static ref TOOLBAR_STYLE: String = class! {
        style("margin", "0px 2px 0px 2px");
        style("height", "24px");
        style("background-color", "hsl(0, 0%, 100%)");
        style("z-index", "3");
        style("border-radius", "2px");
        style("border-width", "1px");
        style("border-color", "hsl(0, 0%, 50%) \
                               hsl(0, 0%, 40%) \
                               hsl(0, 0%, 40%) \
                               hsl(0, 0%, 50%)");
        style("box-shadow", "0px 1px 3px 0px hsl(211, 95%, 45%)");
    };

    static ref GROUP_LIST_STYLE: String = class! {
        style("height", "calc(100% - 24px)");
        style("padding-top", "1px");
        style("overflow", "auto");
    };

    static ref GROUP_STYLE: String = class! {
        style("top", "-1px");
        style("padding-top", "3px");
        style("padding-left", "1px");
        style("padding-right", "1px");
        style("border-top-width", "1px");
        style("border-color", "hsl(211, 50%, 75%)");
        //style("background-color", "hsl(0, 0%, 100%)");
    };

    static ref GROUP_HEADER_STYLE: String = class! {
        style("height", "16px");
        style("padding-left", "4px");
        style("font-size", "11px");
    };

    static ref GROUP_TABS_STYLE: String = class! {
        style("padding-bottom", "3px");
    };

    static ref ICON_STYLE: String = class! {
        style("height", "16px");
        style("border-radius", "4px");
        style("box-shadow", "0px 0px 15px hsla(0, 0%, 100%, 0.9)");
        style("background-color", "hsla(0, 0%, 100%, 0.35)");
    };

    static ref MENU_ITEM_STYLE: String = class! {
        style("border-width", "1px");

        style("transition", "background-color 100ms ease-in-out");

        style_signal("cursor", STATE.is_dragging().map(|is_dragging| {
            if is_dragging {
                None

            } else {
                Some("pointer")
            }
        }));
    };

    static ref MENU_ITEM_SHADOW_STYLE: String = class! {
        style("box-shadow", "      1px 1px  1px hsla(0, 0%,   0%, 0.25), \
                             inset 0px 0px  3px hsla(0, 0%, 100%, 1   ), \
                             inset 0px 0px 10px hsla(0, 0%, 100%, 0.25)");
    };

    static ref REPEATING_GRADIENT: &'static str = "repeating-linear-gradient(-45deg, \
                                                       transparent             0px, \
                                                       transparent             4px, \
                                                       hsla(0, 0%, 100%, 0.05) 6px, \
                                                       hsla(0, 0%, 100%, 0.05) 10px)";

    static ref MENU_ITEM_HOVER_STYLE: String = class! {
        // TODO a bit hacky
        style("transition-duration", "0ms");
        style("color", "hsla(211, 100%, 99%, 0.95)");
        style("background-color", "hsl(211, 100%, 65%)");
        style("border-color", "hsl(211, 38%, 62%) \
                               hsl(211, 38%, 57%) \
                               hsl(211, 38%, 52%) \
                               hsl(211, 38%, 57%)");
        style("text-shadow", "1px 0px 1px hsla(0, 0%, 0%, 0.2), \
                              0px 0px 1px hsla(0, 0%, 0%, 0.1), \
                              0px 1px 1px hsla(0, 0%, 0%, 0.2)");
        style("background-image", &format!("linear-gradient(to bottom, \
                                                hsla(0, 0%, 100%, 0.2) 0%, \
                                                transparent            49%, \
                                                hsla(0, 0%,   0%, 0.1) 50%, \
                                                hsla(0, 0%, 100%, 0.1) 80%, \
                                                hsla(0, 0%, 100%, 0.2) 100%), {}",
                                           *REPEATING_GRADIENT));
    };

    static ref ROW_STYLE: String = class! {
        style("display", "flex");
        style("flex-direction", "row");
        style("align-items", "center"); // TODO get rid of this ?
    };

    static ref TAB_STYLE: String = class! {
        style("padding", "1px");
        style("overflow", "hidden");
        style("border-radius", "5px");
        style("height", "20px");
    };

    static ref TAB_HOVER_STYLE: String = class! {
        style("font-weight", "bold");
    };

    static ref TAB_UNLOADED_STYLE: String = class! {
        style("color", "hsl(0, 0%, 30%)");
        style("opacity", "0.75");
    };

    static ref TAB_SELECTED_STYLE: String = class! {
        style("background-color", "hsl(100, 78%, 80%)");
        style("border-color", "hsl(100, 50%, 55%) \
                               hsl(100, 50%, 50%) \
                               hsl(100, 50%, 45%) \
                               hsl(100, 50%, 50%)");
    };

    static ref TAB_FAVICON_STYLE: String = class! {
        style("width", "16px");
        style("margin-left", "2px");
        style("margin-right", "1px");
    };

    static ref TAB_FAVICON_STYLE_UNLOADED: String = class! {
        style("filter", "grayscale(100%)");
    };

    static ref TAB_TEXT_STYLE: String = class! {
        style("padding-left", "3px");
        style("padding-right", "1px");
    };

    static ref TAB_CLOSE_STYLE: String = class! {
        style("width", "18px");
        style("border-width", "1px");
        style("padding-left", "1px");
        style("padding-right", "1px");
    };

    static ref DRAGGING_STYLE: String = class! {
        style("position", "fixed");
        style("left", "0px");
        style("top", "0px");
        style("overflow", "visible");
        style("pointer-events", "none");
        style("opacity", "0.98");
        style("z-index", HIGHEST_ZINDEX);
    };

    static ref TAB_DRAGGING_STYLE: String = class! {
        style("opacity", "1");
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
    tab_organizer::set_panic_hook();

    let mut top_id = 999999;

    js! { @(no_return)
        setInterval(@{move || {
            {
                let groups = STATE.groups.lock_slice();

                let group = &groups[0];

                let tab = group.tabs.remove(0);
                tab.insert_animation.animate_to(Percentage::new(0.0));
                group.tabs.insert_cloned(0, Arc::new(Tab::new_animated(top_id, "foo", "foo")));

                top_id += 1;

                let tab = group.tabs.pop().unwrap();
                tab.insert_animation.animate_to(Percentage::new(0.0));
                group.tabs.push_cloned(Arc::new(Tab::new_animated(top_id, "foo", "foo")));

                top_id += 1;

                /*{
                    let tabs = group.tabs.lock_slice();
                    let tab = &tabs[4];
                    tab.insert_animation.jump_to(Percentage::new(0.0));
                    tab.insert_animation.animate_to(Percentage::new(1.0));
                }*/

                let group = &groups[2];

                while let Some(tab) = group.tabs.pop() {
                    tab.insert_animation.animate_to(Percentage::new(0.0));
                }
            }

            if let Some(group) = STATE.groups.pop() {
                group.insert_animation.animate_to(Percentage::new(0.0));

                STATE.groups.push_cloned(Arc::new(Group::new_animated(top_id, vec![])));
                top_id += 1;

                {
                    let groups = STATE.groups.lock_slice();

                    let group = &groups[2];

                    for id in 0..10 {
                        let tab = Arc::new(Tab::new_animated(id, "Foo", "Bar"));
                        group.tabs.push_cloned(tab);
                    }
                }
            }
        }}, @{INSERT_ANIMATION_DURATION + 50.0});
    }

    stylesheet!("*", {
        style("text-overflow", "ellipsis");

        style("vertical-align", "middle"); /* TODO I can probably get rid of this */

        /* TODO is this correct ?*/
        style("background-repeat", "no-repeat");
        style("background-size", "100% 100%");
        style("cursor", "inherit");
        style("position", "relative");

        style("box-sizing", "border-box");

        /* TODO are these a good idea ? */
        style("outline-width", "0px");
        style("outline-color", "transparent");
        style("outline-style", "solid");

        style("border-width", "0px");
        style("border-color", "transparent");
        style("border-style", "solid");

        style("margin", "0px");
        style("padding", "0px");

        style("background-color", "transparent");

        style("flex-shrink", "0"); /* 1 */
        style("flex-grow", "0"); /* 1 */
        style("flex-basis", "auto"); /* 0% */ /* TODO try out other stuff like min-content once it becomes available */
    });

    stylesheet!("html, body", {
        style("width", "100%");
        style("height", "100%");

        style(["-moz-user-select", "user-select"], "none");

        style_signal("cursor", STATE.is_dragging().map(|is_dragging| {
            if is_dragging {
                Some("grabbing")

            } else {
                None
            }
        }));
    });

    log!("Starting");

    fn px(t: f64) -> String {
        // TODO find which spots should be rounded and which shouldn't ?
        format!("{}px", t.round())
    }

    fn px_range(t: Percentage, min: f64, max: f64) -> String {
        px(t.range_inclusive(min, max))
    }

    fn float_range(t: Percentage, min: f64, max: f64) -> String {
        t.range_inclusive(min, max).to_string()
    }

    fn ease(t: Percentage) -> Percentage {
        easing::in_out(t, easing::cubic)
    }

    fn none_if<A, F>(signal: A, none_if: f64, mut f: F, min: f64, max: f64) -> impl Signal<Item = Option<String>>
        where A: Signal<Item = Percentage>,
              F: FnMut(Percentage, f64, f64) -> String {
        signal.map(move |t| t.none_if(none_if).map(|t| f(ease(t), min, max)))
    }

    fn delay_animation(animation: &MutableAnimation) -> impl Future<Item = (), Error = Never> {
        animation.signal().wait_for(Percentage::new(0.0)).map(|_| ())
    }

    fn tab_favicon<A: Mixin<DomBuilder<HtmlElement>>>(tab: &Tab, mixin: A) -> Dom {
        html!("img", {
            class(&TAB_FAVICON_STYLE);
            class(&ICON_STYLE);

            class_signal(&TAB_FAVICON_STYLE_UNLOADED, tab.unloaded.signal());

            attribute_signal("src", tab.favicon_url.signal_cloned().map(option_str));

            mixin(mixin);
        })
    }

    fn tab_text<A: Mixin<DomBuilder<HtmlElement>>>(tab: &Tab, mixin: A) -> Dom {
        html!("div", {
            class(&TAB_TEXT_STYLE);

            children(&mut [
                text_signal(map_ref! {
                    let title = tab.title.signal_cloned(),
                    let unloaded = tab.unloaded.signal() => {
                        if *unloaded {
                            if title.is_some() {
                                "➔ "

                            } else {
                                "➔"
                            }

                        } else {
                            ""
                        }
                    }
                }),

                text_signal(tab.title.signal_cloned().map(|x| option_str_default(x, ""))),
            ]);

            mixin(mixin);
        })
    }

    fn tab_template<A: Mixin<DomBuilder<HtmlElement>>>(tab: &Tab, favicon: Dom, text: Dom, mixin: A) -> Dom {
        html!("div", {
            class(&ROW_STYLE);
            class(&TAB_STYLE);
            class(&MENU_ITEM_STYLE);

            class_signal(&TAB_UNLOADED_STYLE, tab.unloaded.signal());

            children(&mut [favicon, text]);

            mixin(mixin);
        })
    }

    dominator::append_dom(&dominator::body(),
        html!("div", {
            class(&TOP_STYLE);
            class(&TEXTURE_STYLE);

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
                    class(&DRAGGING_STYLE);

                    style_signal("display", STATE.is_dragging().map(|is_dragging| {
                        if is_dragging {
                            None

                        } else {
                            Some("none")
                        }
                    }));

                    style_signal("width", STATE.dragging.state.signal_ref(|dragging| {
                        if let Some(DragState::Dragging { rect, .. }) = dragging {
                            Some(px(rect.get_width()))

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
                            // TODO don't create the animation at all for index 0
                            let animation = MutableAnimation::new(150.0);

                            if index > 0 {
                                animation.animate_to(Percentage::new(1.0));
                            }

                            Dom::with_state(animation, |animation| {
                                tab_template(&tab,
                                    tab_favicon(&tab, |dom| dom),
                                    tab_text(&tab, |dom| dom),
                                    |mut dom: DomBuilder<HtmlElement>| {
                                        dom = dom
                                            .class(&TAB_SELECTED_STYLE)
                                            .class(&MENU_ITEM_SHADOW_STYLE)
                                            .class(&TAB_DRAGGING_STYLE)
                                            .style("z-index", &format!("-{}", index));

                                        // TODO use ease-out easing
                                        if index > 0 && index < 5 {
                                            dom = dom.style_signal("margin-top", none_if(animation.signal(), 0.0, px_range, 0.0, -(TAB_HEIGHT - 2.0)));

                                        } else if index >= 5 {
                                            dom = dom.style_signal("margin-top", none_if(animation.signal(), 0.0, px_range, 0.0, -TAB_HEIGHT));
                                        }

                                        // TODO use ease-out easing
                                        if index >= 5 {
                                            dom = dom.style_signal("opacity", none_if(animation.signal(), 0.0, float_range, 1.0, 0.0));
                                        }

                                        dom
                                    })
                            })
                        }).collect()
                    }).to_signal_vec());
                }),

                html!("div", {
                    class(&ROW_STYLE);
                    class(&TOOLBAR_STYLE);
                }),

                html!("div", {
                    class(&GROUP_LIST_STYLE);

                    children_signal_vec(STATE.groups.signal_vec_cloned().enumerate()
                        .delay_remove(|(_, group)| delay_animation(&group.insert_animation))
                        .map(move |(index, group)| {
                            if let Some(index) = index.get() {
                                if STATE.should_be_dragging_group(index) {
                                    group.drag_top.jump_to(Percentage::new(1.0));
                                }
                            }

                            html!("div", {
                                class(&GROUP_STYLE);

                                style_signal("top", none_if(group.drag_top.signal(), 0.0, px_range, 0.0, DRAG_GAP_PX));
                                style_signal("padding-bottom", none_if(group.drag_over.signal(), 0.0, px_range, 0.0, DRAG_GAP_PX));
                                style_signal("margin-bottom", none_if(group.drag_over.signal(), 0.0, px_range, 0.0, -DRAG_GAP_PX));

                                style_signal("padding-top", none_if(group.insert_animation.signal(), 1.0, px_range, 0.0, 3.0));
                                style_signal("border-top-width", none_if(group.insert_animation.signal(), 1.0, px_range, 0.0, 1.0));
                                style_signal("opacity", none_if(group.insert_animation.signal(), 1.0, float_range, 0.0, 1.0));

                                children(&mut [
                                    html!("div", {
                                        class(&ROW_STYLE);
                                        class(&GROUP_HEADER_STYLE);

                                        style_signal("height", none_if(group.insert_animation.signal(), 1.0, px_range, 0.0, 16.0));
                                        style_signal("margin-left", none_if(group.insert_animation.signal(), 1.0, px_range, INSERT_LEFT_MARGIN, 0.0));

                                        children(&mut [
                                            text_signal(map_ref! {
                                                    let name = group.name.signal_cloned(),
                                                    let index = index.signal() => {
                                                        // TODO improve the efficiency of this ?
                                                        name.clone().or_else(|| {
                                                            index.map(|index| Arc::new(format!("{}", index)))
                                                        })
                                                    }
                                                }
                                                // This causes it to remember the previous value if it returns `None`
                                                // TODO dedicated method for this ?
                                                .filter_map(|x| x)
                                                .map(|x| option_str_default(x, ""))),
                                        ]);
                                    }),

                                    html!("div", {
                                        class(&GROUP_TABS_STYLE);

                                        style_signal("padding-bottom", none_if(group.insert_animation.signal(), 1.0, px_range, 0.0, 3.0));

                                        children_signal_vec(group.tabs.signal_vec_cloned().enumerate()
                                            .delay_remove(|(_, tab)| delay_animation(&tab.insert_animation))
                                            .map(move |(index, tab)| {
                                                if let Some(index) = index.get() {
                                                    if STATE.should_be_dragging_tab(group.id, index) {
                                                        tab.drag_over.jump_to(Percentage::new(1.0));
                                                    }
                                                }

                                                tab_template(&tab,
                                                    tab_favicon(&tab, |dom: DomBuilder<HtmlElement>| {
                                                        dom.style_signal("height", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, 16.0))
                                                    }),

                                                    tab_text(&tab, |dom: DomBuilder<HtmlElement>| {
                                                        dom.style_signal("transform", tab.insert_animation.signal().map(|t| {
                                                            t.none_if(1.0).map(|t| format!("rotateX({}deg)", ease(t).range_inclusive(-90.0, 0.0)))
                                                        }))
                                                    }),

                                                    |dom: DomBuilder<HtmlElement>| dom
                                                        .class_signal(&TAB_SELECTED_STYLE, tab.selected.signal())
                                                        .class_signal(&TAB_HOVER_STYLE, tab.is_hovered())
                                                        .class_signal(&MENU_ITEM_HOVER_STYLE, tab.is_hovered())
                                                        .class_signal(&MENU_ITEM_SHADOW_STYLE, or(tab.is_hovered(), tab.selected.signal()))

                                                        .style_signal("margin-left", none_if(tab.insert_animation.signal(), 1.0, px_range, INSERT_LEFT_MARGIN, 0.0))
                                                        .style_signal("height", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_HEIGHT))
                                                        .style_signal("padding-top", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, 1.0))
                                                        .style_signal("padding-bottom", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, 1.0))
                                                        .style_signal("border-top-width", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, 1.0))
                                                        .style_signal("border-bottom-width", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, 1.0))
                                                        .style_signal("opacity", none_if(tab.insert_animation.signal(), 1.0, float_range, 0.0, 1.0))

                                                        .style_signal("display", tab.dragging.signal().map(|is_dragging| {
                                                            if is_dragging {
                                                                Some("none")

                                                            } else {
                                                                None
                                                            }
                                                        }))

                                                        .style_signal("top", none_if(tab.drag_over.signal(), 0.0, px_range, 0.0, DRAG_GAP_PX))

                                                        // TODO a bit hacky
                                                        .with_element(|dom, element: HtmlElement| {
                                                            dom.event(clone!(index, group, tab => move |e: MouseDownEvent| {
                                                                if let Some(index) = index.get() {
                                                                    let rect = element.get_bounding_client_rect();
                                                                    STATE.drag_start(e.client_x(), e.client_y(), rect, group.clone(), tab.clone(), index);
                                                                }
                                                            }))
                                                        })

                                                        .event(clone!(index, group, tab => move |_: MouseOverEvent| {
                                                            // TODO should this be inside of the if ?
                                                            tab.hovered.set(true);

                                                            if let Some(index) = index.get() {
                                                                STATE.drag_over(group.clone(), index);
                                                            }
                                                        }))

                                                        .event(clone!(tab => move |_: MouseOutEvent| {
                                                            // TODO should this check the index, like MouseOverEvent ?
                                                            tab.hovered.set(false);
                                                        }))

                                                        // TODO replace with MouseClickEvent
                                                        .event(clone!(index, group, tab => move |e: MouseUpEvent| {
                                                            if index.get().is_some() {
                                                                let shift = e.shift_key();
                                                                // TODO is this correct ?
                                                                // TODO test this, especially on Mac
                                                                // TODO what if both of these are true ?
                                                                let ctrl = e.ctrl_key() || e.meta_key();
                                                                let alt = e.alt_key();

                                                                match e.button() {
                                                                    MouseButton::Left => if ctrl && !shift && !alt {
                                                                        group.ctrl_select_tab(&tab);

                                                                    } else if !ctrl && shift && !alt {
                                                                        group.shift_select_tab(&tab);

                                                                    } else if !ctrl && !shift && !alt {
                                                                        group.click_tab(&tab);
                                                                    },
                                                                    _ => {},
                                                                }
                                                            }
                                                        })))
                                            }));
                                    }),
                                ]);
                            })
                        }));
                }),
            ]);
        }),
    );

    log!("Finished");
}
