#![recursion_limit="128"]
#![warn(unreachable_pub)]

extern crate uuid;
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

use std::borrow::Borrow;
use std::sync::{Arc, RwLock};
use tab_organizer::{generate_uuid, and, or, not, normalize, ScrollEvent};
use tab_organizer::state;
use tab_organizer::state::{SidebarMessage, TabChange, Options, SortTabs};
use dominator::traits::*;
use dominator::{Dom, DomBuilder, text, text_signal, HIGHEST_ZINDEX, DerefFn};
use dominator::animation::{Percentage, MutableAnimation, OnTimestampDiff};
use dominator::animation::easing;
use dominator::events::{MouseDownEvent, MouseEnterEvent, InputEvent, MouseLeaveEvent, MouseMoveEvent, MouseUpEvent, MouseButton, IMouseEvent, ResizeEvent, ClickEvent};
use stdweb::PromiseFuture;
use stdweb::web::{Date, HtmlElement, Rect, IElement, IHtmlElement, set_timeout};
use stdweb::web::html_element::InputElement;
use futures_signals::signal::{Signal, IntoSignal, Mutable, SignalExt};
use futures_signals::signal_vec::SignalVecExt;

use menu::Menu;
use group::{Tab, Group, Window, TabState};
use groups::Groups;

mod parse;
mod waiter;
mod url_bar;
mod menu;
mod groups;
mod group;


const LOADING_MESSAGE_THRESHOLD: u32 = 500;

const MOUSE_SCROLL_THRESHOLD: f64 = 30.0; // Number of pixels before it starts scrolling
const MOUSE_SCROLL_SPEED: f64 = 0.5; // Number of pixels to move per millisecond

const INSERT_ANIMATION_DURATION: f64 = 800.0;
const DRAG_ANIMATION_DURATION: f64 = 100.0;
const SELECTED_TABS_ANIMATION_DURATION: f64 = 150.0;

const TAB_DRAGGING_THRESHOLD: f64 = 7.0; // Pixels the mouse has to move before dragging begins
const TAB_DRAGGING_TOP: i32 = 11;
const DRAG_GAP_PX: f64 = 32.0; // TODO adjust this based on how many tabs are being dragged
const INSERT_LEFT_MARGIN: f64 = 12.0;

const TOOLBAR_HEIGHT: f64 = 20.0;
const TOOLBAR_BORDER_WIDTH: f64 = 1.0;
const TOOLBAR_MARGIN: f64 = 2.0;
const TOOLBAR_TOTAL_HEIGHT: f64 = TOOLBAR_MARGIN + (TOOLBAR_BORDER_WIDTH * 2.0) + TOOLBAR_HEIGHT;

const GROUP_BORDER_WIDTH: f64 = 1.0;
const GROUP_PADDING_TOP: f64 = 3.0;
const GROUP_HEADER_HEIGHT: f64 = 16.0;
const GROUP_PADDING_BOTTOM: f64 = 3.0;

const TAB_BORDER_WIDTH: f64 = 1.0;
const TAB_PADDING: f64 = 1.0;
const TAB_HEIGHT: f64 = 16.0;
const TAB_FAVICON_SIZE: f64 = 16.0;
const TAB_CLOSE_BORDER_WIDTH: f64 = 1.0;
const TAB_TOTAL_HEIGHT: f64 = (TAB_BORDER_WIDTH * 2.0) + (TAB_PADDING * 2.0) + TAB_HEIGHT;


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
}

impl Dragging {
    fn new() -> Self {
        Self {
            state: Mutable::new(None),
            selected_tabs: Mutable::new(vec![]),
        }
    }
}


struct Scrolling {
    on_timestamp_diff: Mutable<Option<OnTimestampDiff>>,
    y: Mutable<f64>,
    height: Mutable<f64>,
}

impl Scrolling {
    fn new(scroll_y: f64) -> Self {
        Self {
            on_timestamp_diff: Mutable::new(None),
            y: Mutable::new(scroll_y),
            height: Mutable::new(0.0),
        }
    }
}


struct State {
    search_box: Mutable<Arc<String>>,
    search_parser: Mutable<parse::Parsed>,

    url_bar: Mutable<Option<Arc<url_bar::UrlBar>>>,
    groups_padding: Mutable<f64>, // TODO use u32 instead ?

    groups: Groups,
    window: RwLock<Window>,
    options: Options,

    dragging: Dragging,
    scrolling: Scrolling,

    menu: Menu,
}

impl State {
    fn new(options: Options, initial_window: state::Window) -> Self {
        let window = Window::new(initial_window);

        let local_storage = stdweb::web::window().local_storage();

        let search_value = local_storage.get("tab-organizer.search").unwrap_or_else(|| "".to_string());
        let scroll_y = local_storage.get("tab-organizer.scroll.y").map(|value| value.parse().unwrap()).unwrap_or(0.0);

        Self {
            search_parser: Mutable::new(parse::Parsed::new(&search_value)),
            search_box: Mutable::new(Arc::new(search_value)),

            url_bar: Mutable::new(None),
            groups_padding: Mutable::new(0.0),

            groups: Groups::new(options.sort_tabs.get(), &window),
            window: RwLock::new(window),
            options,

            dragging: Dragging::new(),
            scrolling: Scrolling::new(scroll_y),

            menu: Menu::new(),
        }
    }

    fn update_dragging_groups<F>(&self, group_id: usize, mut f: F) where F: FnMut(&Group, Percentage) {
        let groups = self.groups.lock_ref();

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
                Some(tab_index.unwrap_or_else(|| group.tabs.lock_ref().len()))

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
            let groups = self.groups.lock_ref();

            let old_index = Self::find_group_index(&groups, group.id);

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

    fn start_scrolling(&self, mouse_y: i32) {
        // TODO is there a better way of calculating this ?
        let top = TOOLBAR_TOTAL_HEIGHT;
        let bottom = stdweb::web::window().inner_height() as f64;
        let threshold = MOUSE_SCROLL_THRESHOLD / (bottom - top).abs();
        let percentage = normalize(mouse_y as f64, top, bottom);
        let percentage = percentage - 0.5;
        let sign = percentage.signum();
        let percentage = easing::cubic(Percentage::new(normalize(percentage.abs(), 0.5 - threshold, 0.5))).into_f64() * sign;

        if percentage == 0.0 {
            self.scrolling.on_timestamp_diff.set(None);

        } else {
            let percentage = percentage * MOUSE_SCROLL_SPEED;

            let y = self.scrolling.y.clone();

            // TODO initialize this inside of the OnTimestampDiff callback ?
            let starting_y = y.get();

            self.scrolling.on_timestamp_diff.set(Some(OnTimestampDiff::new(move |diff| {
                y.set_neq(starting_y + (diff * percentage));
            })));
        }
    }

    fn drag_move(&self, new_x: i32, new_y: i32) {
        let mut dragging = self.dragging.state.lock_mut();

        let new_dragging = match *dragging {
            Some(DragState::DragStart { mouse_x, mouse_y, ref rect, ref group, ref tab, tab_index }) => {
                let mouse_x = (mouse_x - new_x) as f64;
                let mouse_y = (mouse_y - new_y) as f64;

                if mouse_x.hypot(mouse_y) > TAB_DRAGGING_THRESHOLD {
                    let tab_index = Some(tab_index);

                    let selected_tabs: Vec<Arc<Tab>> = if tab.selected.get() {
                        group.tabs.lock_ref().iter()
                            .filter(|x| x.selected.get() && x.matches_search.get() && !x.removing.get())
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
                            tab.dragging.set_neq(true);
                        }

                        self.dragging.selected_tabs.set(selected_tabs);

                        self.start_scrolling(new_y);

                        Some(DragState::Dragging { mouse_x: new_x, mouse_y: new_y, rect: rect.clone(), group: group.clone(), tab_index })

                    } else {
                        None
                    }

                } else {
                    None
                }
            },

            Some(DragState::Dragging { ref mut mouse_x, ref mut mouse_y, .. }) => {
                self.start_scrolling(new_y);
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

    fn find_group_index(groups: &[Arc<Group>], group_id: usize) -> usize {
        groups.iter().position(|x| x.id == group_id).unwrap_or_else(|| groups.len())
    }

    fn change_groups(&self, old_group: &Group, new_group: &Group) {
        old_group.drag_over.animate_to(Percentage::new(0.0));
        new_group.drag_over.animate_to(Percentage::new(1.0));

        self.update_dragging_groups(new_group.id, |group, percentage| {
            group.drag_top.animate_to(percentage);
        });

        old_group.tabs_each(|tab| {
            tab.drag_over.animate_to(Percentage::new(0.0));
        });
    }

    fn drag_over(&self, new_group: Arc<Group>, new_index: usize) {
        let groups = self.groups.lock_ref();

        // TODO is this correct ?
        // TODO pass in the new_group_index as a function argument
        if let Some(new_group_index) = groups.iter().position(|x| x.id == new_group.id) {
            let mut dragging = self.dragging.state.lock_mut();

            // TODO verify that this doesn't notify if it isn't dragging
            if let Some(DragState::Dragging { ref mut group, ref mut tab_index, .. }) = *dragging {
                let len = new_group.tabs.lock_ref().len();

                let new_tab_index = if new_group.id == group.id {
                    // TODO code duplication with get_dragging_index
                    let old_index = tab_index.unwrap_or(len);

                    if old_index <= new_index {
                        let new_index = new_index + 1;

                        if new_index < len {
                            Some(new_index)

                        } else {
                            None
                        }

                    } else {
                        Some(new_index)
                    }

                } else {
                    self.change_groups(&group, &new_group);

                    let old_group_index = Self::find_group_index(&groups, group.id);

                    if new_index == (len - 1) {
                        None

                    } else if old_group_index <= new_group_index {
                        let new_index = new_index + 1;

                        if new_index < len {
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

    fn drag_over_group(&self, new_group: Arc<Group>, new_group_index: usize) {
        let mut dragging = self.dragging.state.lock_mut();

        // TODO verify that this doesn't notify if it isn't dragging
        if let Some(DragState::Dragging { ref mut group, ref mut tab_index, .. }) = *dragging {
            let new_tab_index = if new_group.id == group.id {
                // TODO it shouldn't notify dragging
                return;

            } else {
                self.change_groups(&group, &new_group);

                let groups = self.groups.lock_ref();

                let old_group_index = Self::find_group_index(&groups, group.id);

                if old_group_index < new_group_index {
                    Some(0)

                } else {
                    None
                }
            };

            new_group.update_dragging_tabs(new_tab_index, |tab, percentage| {
                tab.drag_over.animate_to(percentage);
            });

            *group = new_group;
            *tab_index = new_tab_index;
        }
    }

    fn drag_end(&self) {
        let mut dragging = self.dragging.state.lock_mut();
        let mut selected_tabs = self.dragging.selected_tabs.lock_mut();

        if let Some(DragState::Dragging { ref group, .. }) = *dragging {
            self.scrolling.on_timestamp_diff.set(None);

            group.drag_over.jump_to(Percentage::new(0.0));

            group.tabs_each(|tab| {
                tab.drag_over.jump_to(Percentage::new(0.0));
            });

            {
                let groups = self.groups.lock_ref();

                for group in groups.iter() {
                    group.drag_top.jump_to(Percentage::new(0.0));
                }
            }

            self.drag_tabs_to(&group, &**selected_tabs);
        }

        if dragging.is_some() {
            *dragging = None;
        }

        if selected_tabs.len() != 0 {
            for tab in selected_tabs.iter() {
                tab.dragging.set_neq(false);
            }

            *selected_tabs = vec![];
        }
    }

    fn drag_tabs_to(&self, group: &Group, tabs: &[Arc<Tab>]) {
        if !group.removing.get() {
        }
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

    fn is_window_mode(&self) -> impl Signal<Item = bool> {
        self.options.sort_tabs.signal_ref(|x| *x == SortTabs::Window)
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

    fn is_tab_hovered(&self, tab: &Tab) -> impl Signal<Item = bool> {
        and(tab.hovered.signal(), not(self.is_dragging()))
    }

    fn is_tab_holding(&self, tab: &Tab) -> impl Signal<Item = bool> {
        and(
            and(self.is_tab_hovered(tab), tab.holding.signal()),
            // TODO a little bit hacky
            not(tab.close_hovered.signal())
        )
    }

    fn hover_tab(&self, tab: &Tab) {
        if !tab.hovered.get() {
            tab.hovered.set(true);

            let url = tab.url.lock_ref();

            self.url_bar.set(url.as_ref().and_then(|url| {
                url_bar::UrlBar::new(&url).map(|x| Arc::new(x.minify()))
            }));
        }
    }

    fn unhover_tab(&self, tab: &Tab) {
        if tab.hovered.get() {
            tab.hovered.set(false);

            self.url_bar.set(None);
        }
    }

    fn hide_tab(&self, tab: &Tab) {
        tab.visible.set_neq(false);
        tab.holding.set_neq(false);
        tab.close_hovered.set_neq(false);
        tab.close_holding.set_neq(false);
        self.unhover_tab(tab);
    }

    // TODO debounce this ?
    // TODO make this simpler somehow ?
    // TODO add in stuff to handle dragging
    fn update(&self, should_search: bool) {
        // TODO add STATE.dragging.state to the waiter
        let dragging = self.dragging.state.lock_ref();
        let search_parser = self.search_parser.lock_ref();

        let top_y = self.scrolling.y.get().round();
        let bottom_y = top_y + (stdweb::web::window().inner_height() as f64 - TOOLBAR_TOTAL_HEIGHT);

        let mut padding: Option<f64> = None;
        let mut current_height: f64 = 0.0;

        self.groups.lock_mut().retain(|group| {
            if group.removing.get() && group.insert_animation.current_percentage() == Percentage::new(0.0) {
                false

            } else {
                let mut matches_search = false;

                let old_height = current_height;

                let mut tabs_padding: Option<f64> = None;

                let (top_height, bottom_height) = group.height();

                current_height += top_height;

                let tabs_height = current_height;

                // TODO what if there aren't any tabs in the group ?
                group.tabs.lock_mut().retain(|tab| {
                    if tab.removing.get() && tab.insert_animation.current_percentage() == Percentage::new(0.0) {
                        false

                    } else {
                        if should_search {
                            if search_parser.matches_tab(tab) {
                                tab.matches_search.set_neq(true);

                            } else {
                                tab.matches_search.set_neq(false);
                            }
                        }

                        // TODO what about if all the tabs are being dragged ?
                        if tab.matches_search.get() {
                            matches_search = true;

                            if !tab.dragging.get() {
                                let old_height = current_height;

                                current_height += tab.height();

                                if old_height < bottom_y && current_height > top_y {
                                    if let None = tabs_padding {
                                        tabs_padding = Some(old_height);
                                    }

                                    tab.visible.set_neq(true);

                                } else {
                                    self.hide_tab(&tab);
                                }

                            } else {
                                self.hide_tab(&tab);
                            }

                        } else {
                            self.hide_tab(&tab);
                        }

                        true
                    }
                });

                if should_search {
                    if matches_search {
                        group.matches_search.set_neq(true);

                    } else {
                        group.matches_search.set_neq(false);
                    }
                }

                if matches_search {
                    let no_tabs_height = current_height;

                    current_height += bottom_height;

                    if old_height < bottom_y && current_height > top_y {
                        if let None = padding {
                            padding = Some(old_height);
                        }

                        group.tabs_padding.set_neq(tabs_padding.unwrap_or(no_tabs_height) - tabs_height);
                        group.visible.set_neq(true);

                    } else {
                        group.visible.set_neq(false);
                    }

                } else {
                    current_height = old_height;
                    group.visible.set_neq(false);
                }

                true
            }
        });

        if let Some(DragState::Dragging { .. }) = *dragging {
            // TODO handle this better somehow ?
            current_height += DRAG_GAP_PX;
        }

        self.groups_padding.set_neq(padding.unwrap_or(0.0));
        self.scrolling.height.set_neq(current_height);
    }


    fn process_message(&self, message: SidebarMessage) {
        match message {
            SidebarMessage::TabInserted { tab_index, tab } => {
                let mut window = self.window.write().unwrap();

                let tab = Arc::new(TabState::new(tab));

                self.groups.tab_inserted(tab_index, tab.clone());

                window.tabs.insert(tab_index, tab);
            },

            SidebarMessage::TabRemoved { tab_index } => {
                let mut window = self.window.write().unwrap();

                let tab = window.tabs.remove(tab_index);

                self.groups.tab_removed(tab_index, &tab);
            },

            SidebarMessage::TabChanged { tab_index, change } => {
                let window = self.window.read().unwrap();

                let tab = &window.tabs[tab_index];

                match change {
                    TabChange::Title { new_title } => {
                        tab.title.set(new_title.map(Arc::new));
                    },
                    TabChange::Pinned { pinned } => {},
                }
            },
        }
    }
}


fn option_str(x: Option<Arc<String>>) -> Option<DerefFn<Arc<String>, impl Fn(&Arc<String>) -> &str>> {
    x.map(|x| DerefFn::new(x, move |x| x.as_str()))
}

fn option_str_default<A: Borrow<String>>(x: Option<A>, default: &'static str) -> DerefFn<Option<A>, impl Fn(&Option<A>) -> &str> {
    DerefFn::new(x, move |x| {
        x.as_ref().map(|x| x.borrow().as_str()).unwrap_or(default)
    })
}

fn option_str_default_fn<A, F>(x: Option<A>, default: &'static str, f: F) -> DerefFn<Option<A>, impl Fn(&Option<A>) -> &str> where F: Fn(&A) -> &Option<String> {
    DerefFn::new(x, move |x| {
        if let Some(x) = x {
            if let Some(x) = f(x) {
                x.as_str()

            } else {
                default
            }

        } else {
            default
        }
    })
}

fn is_empty<A: Borrow<String>>(input: &Option<A>) -> bool {
    input.as_ref().map(|x| x.borrow().len() == 0).unwrap_or(true)
}

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

#[inline]
fn visible<A, B>(signal: B) -> impl FnOnce(DomBuilder<A>) -> DomBuilder<A>
    where A: IHtmlElement + Clone + 'static,
          B: IntoSignal<Item = bool>,
          B::Signal: 'static {

    // TODO is this inline a good idea ?
    #[inline]
    move |dom| {
        dom.style_signal("display", signal.into_signal().map(|visible| {
            if visible {
                None

            } else {
                Some("none")
            }
        }))
    }
}

#[inline]
fn cursor<A, B>(is_dragging: A, cursor: &'static str) -> impl FnOnce(DomBuilder<B>) -> DomBuilder<B>
    where A: IntoSignal<Item = bool>,
          A::Signal: 'static,
          B: IHtmlElement + Clone + 'static {

    // TODO is this inline a good idea ?
    #[inline]
    move |dom| {
        dom.style_signal("cursor", is_dragging.into_signal().map(move |is_dragging| {
            if is_dragging {
                None

            } else {
                Some(cursor)
            }
        }))
    }
}

fn none_if<A, F>(signal: A, none_if: f64, mut f: F, min: f64, max: f64) -> impl Signal<Item = Option<String>>
    where A: Signal<Item = Percentage>,
          F: FnMut(Percentage, f64, f64) -> String {
    signal.map(move |t| t.none_if(none_if).map(|t| f(ease(t), min, max)))
}


lazy_static! {
    static ref FAILED: Mutable<Option<Arc<String>>> = Mutable::new(None);

    static ref IS_LOADED: Mutable<bool> = Mutable::new(false);

    static ref ROW_STYLE: String = class! {
        .style("display", "flex")
        .style("flex-direction", "row")
        .style("align-items", "center") // TODO get rid of this ?
    };

    static ref STRETCH_STYLE: String = class! {
        .style("flex-shrink", "1")
        .style("flex-grow", "1")
        .style("flex-basis", "0%")
    };

    static ref TOP_STYLE: String = class! {
        .style("white-space", "pre")
        .style("font-family", "sans-serif")
        .style("font-size", "13px")
        .style("width", "300px") // 100%
        .style("height", "100%")
        .style("background-color", "hsl(0, 0%, 100%)")
        .style("overflow", "hidden")
    };

    static ref TEXTURE_STYLE: String = class! {
        .style("background-image", "repeating-linear-gradient(0deg, \
                                        transparent                0px, \
                                        hsla(200, 30%, 30%, 0.022) 2px, \
                                        hsla(200, 30%, 30%, 0.022) 3px)")
    };

    static ref MODAL_STYLE: String = class! {
        .style("position", "fixed")
        .style("left", "0px")
        .style("top", "0px")
        .style("width", "100%")
        .style("height", "100%")
        .style("background-color", "hsla(0, 0%, 0%, 0.15)")
    };

    static ref LOADING_STYLE: String = class! {
        .style("z-index", HIGHEST_ZINDEX)
        .style("background-color", "transparent")
        .style("color", "white")
        .style("font-weight", "bold")
        .style("font-size", "20px")
        .style("letter-spacing", "5px")
        .style("text-shadow", "1px 1px 1px black, 0px 0px 1px black")
    };

    static ref CENTER_STYLE: String = class! {
        .style("display", "flex")
        .style("flex-direction", "row")
        .style("align-items", "center")
        .style("justify-content", "center")
    };

    static ref REPEATING_GRADIENT: &'static str = "repeating-linear-gradient(-45deg, \
                                                       transparent             0px, \
                                                       transparent             4px, \
                                                       hsla(0, 0%, 100%, 0.05) 6px, \
                                                       hsla(0, 0%, 100%, 0.05) 10px)";

    static ref MENU_ITEM_HOVER_STYLE: String = class! {
        // TODO a bit hacky
        .style("transition-duration", "0ms")
        .style("color", "hsla(211, 100%, 99%, 0.95)")
        .style("background-color", "hsl(211, 100%, 65%)")
        .style("border-color", "hsl(211, 38%, 62%) \
                                hsl(211, 38%, 57%) \
                                hsl(211, 38%, 52%) \
                                hsl(211, 38%, 57%)")
        .style("text-shadow", "1px 0px 1px hsla(0, 0%, 0%, 0.2), \
                               0px 0px 1px hsla(0, 0%, 0%, 0.1), \
                               0px 1px 1px hsla(0, 0%, 0%, 0.2)")
        .style("background-image", &format!("linear-gradient(to bottom, \
                                                 hsla(0, 0%, 100%, 0.2) 0%, \
                                                 transparent            49%, \
                                                 hsla(0, 0%,   0%, 0.1) 50%, \
                                                 hsla(0, 0%, 100%, 0.1) 80%, \
                                                 hsla(0, 0%, 100%, 0.2) 100%), {}",
                                            *REPEATING_GRADIENT))
        .style("z-index", "1")
    };

    static ref TOOLBAR_STYLE: String = class! {
        .style("height", &px(TOOLBAR_HEIGHT))
        .style("border-width", &px(TOOLBAR_BORDER_WIDTH))
        .style("margin-top", &px(TOOLBAR_MARGIN))
        .style("margin-left", "2px")
        .style("margin-right", "2px")
        .style("background-color", "hsl(0, 0%, 100%)")
        .style("z-index", "3")
        .style("border-radius", "2px")
        .style("border-color", "hsl(0, 0%, 50%) \
                                hsl(0, 0%, 40%) \
                                hsl(0, 0%, 40%) \
                                hsl(0, 0%, 50%)")
        .style("box-shadow", "0px 1px 3px 0px hsl(211, 95%, 45%)")
    };

    static ref TOOLBAR_SEPARATOR_STYLE: String = class! {
        .style("background-color", "hsl(211, 95%, 40%)")
        .style("width", "1px")
        .style("height", "100%")
    };

    static ref TOOLBAR_MENU_WRAPPER_STYLE: String = class! {
        .style("height", "100%")
    };

    static ref TOOLBAR_MENU_STYLE: String = class! {
        .style("height", "100%")
        .style("padding-left", "11px")
        .style("padding-right", "11px")
        .style("box-shadow", "inset 0px 0px 1px 0px hsl(211, 95%, 70%)")
    };

    static ref TOOLBAR_MENU_HOLD_STYLE: String = class! {
        .style("top", "1px")
    };

    static ref SEARCH_STYLE: String = class! {
        .style("box-sizing", "border-box")
        .style("padding-top", "2px")
        .style("padding-bottom", "2px")
        .style("padding-left", "5px")
        .style("padding-right", "5px")
        .style("height", "100%")

        .style_signal("background-color", FAILED.signal_cloned().map(|failed| {
            if failed.is_some() {
                Some("hsl(5, 100%, 90%)")

            } else {
                None
            }
        }))

        .style("box-shadow", "inset 0px 0px 1px 0px hsl(211, 95%, 70%)")
    };

    static ref GROUP_LIST_STYLE: String = class! {
        .style("height", &format!("calc(100% - {}px)", TOOLBAR_TOTAL_HEIGHT))
        .style("overflow", "auto")
    };

    static ref GROUP_LIST_CHILDREN_STYLE: String = class! {
        .style("box-sizing", "border-box")
        .style("overflow", "hidden")
        .style("top", "1px")
    };

    static ref GROUP_STYLE: String = class! {
        .style("padding-top", &px(GROUP_PADDING_TOP))
        .style("border-top-width", &px(GROUP_BORDER_WIDTH))
        .style("top", "-1px")
        .style("padding-left", "1px")
        .style("padding-right", "1px")
        .style("border-color", "hsl(211, 50%, 75%)")
        //.style("background-color", "hsl(0, 0%, 100%)")
    };

    static ref GROUP_HEADER_STYLE: String = class! {
        .style("box-sizing", "border-box")
        .style("height", &px(GROUP_HEADER_HEIGHT))
        .style("padding-left", "4px")
        .style("font-size", "11px")
    };

    static ref GROUP_HEADER_TEXT_STYLE: String = class! {
        .style("overflow", "hidden")
    };

    static ref GROUP_TABS_STYLE: String = class! {
        .style("padding-bottom", &px(GROUP_PADDING_BOTTOM))
    };

    static ref ICON_STYLE: String = class! {
        .style("height", &px(TAB_FAVICON_SIZE))
        .style("border-radius", "4px")
        .style("box-shadow", "0px 0px 15px hsla(0, 0%, 100%, 0.9)")
        .style("background-color", "hsla(0, 0%, 100%, 0.35)")
    };

    static ref MENU_ITEM_STYLE: String = class! {
        .style("border-width", &px(TAB_BORDER_WIDTH))

        .style("transition", "background-color 100ms ease-in-out")
    };

    static ref MENU_ITEM_SHADOW_STYLE: String = class! {
        .style("box-shadow", "      1px 1px  1px hsla(0, 0%,   0%, 0.25), \
                              inset 0px 0px  3px hsla(0, 0%, 100%, 1   ), \
                              inset 0px 0px 10px hsla(0, 0%, 100%, 0.25)")
    };

    static ref MENU_ITEM_HOLD_STYLE: String = class! {
        .style("background-position", "0px 1px")
        .style("background-image", &format!("linear-gradient(to bottom, \
                                                 hsla(0, 0%, 100%, 0.2)   0%, \
                                                 transparent              49%, \
                                                 hsla(0, 0%,   0%, 0.075) 50%, \
                                                 hsla(0, 0%, 100%, 0.1)   80%, \
                                                 hsla(0, 0%, 100%, 0.2)   100%), {}",
                                            *REPEATING_GRADIENT))
        .style("box-shadow",      "1px 1px  1px hsla(0, 0%,   0%, 0.1), \
                             inset 0px 0px  3px hsla(0, 0%, 100%, 0.9), \
                             inset 0px 0px 10px hsla(0, 0%, 100%, 0.225)")
    };

    static ref TAB_STYLE: String = class! {
        .style("padding", &px(TAB_PADDING))
        .style("height", &px(TAB_HEIGHT))
        .style("overflow", "hidden")
        .style("border-radius", "5px")
    };

    static ref TAB_HOVER_STYLE: String = class! {
        .style("font-weight", "bold")
    };

    static ref TAB_HOLD_STYLE: String = class! {
        .style("padding-top", "2px")
        .style("padding-bottom", "0px")
    };

    static ref TAB_UNLOADED_STYLE: String = class! {
        .style("color", "hsl(0, 0%, 30%)")
        .style("opacity", "0.75")
    };

    static ref TAB_UNLOADED_HOVER_STYLE: String = class! {
        .style("background-color", "hsla(0, 0%, 0%, 0.4)")

        // TODO this is needed to override the border color from TAB_FOCUSED_STYLE
        .style_important("border-color", "hsl(0, 0%, 62%) \
                                          hsl(0, 0%, 57%) \
                                          hsl(0, 0%, 52%) \
                                          hsl(0, 0%, 57%)")

        .style("color", "hsla(0, 0%, 99%, 0.95)") // TODO minor code duplication with `MENU_ITEM_HOVER_STYLE`
        .style("opacity", "1")
    };

    static ref TAB_FOCUSED_STYLE: String = class! {
        .style("background-color", "hsl(30, 100%, 94%")
        // TODO this is needed to override the border color from MENU_ITEM_HOVER_STYLE
        .style_important("border-color", "hsl(30, 70%, 62%) \
                                          hsl(30, 70%, 57%) \
                                          hsl(30, 70%, 52%) \
                                          hsl(30, 70%, 57%)")
    };

    static ref TAB_FOCUSED_HOVER_STYLE: String = class! {
        .style("background-color", "hsl(30, 85%, 57%)")
    };

    static ref TAB_SELECTED_STYLE: String = class! {
        .style("background-color", "hsl(100, 78%, 80%)")
        // TODO this is needed to override the border color from TAB_FOCUSED_STYLE
        .style_important("border-color", "hsl(100, 50%, 55%) \
                                          hsl(100, 50%, 50%) \
                                          hsl(100, 50%, 45%) \
                                          hsl(100, 50%, 50%)")
    };

    static ref TAB_SELECTED_HOVER_STYLE: String = class! {
        .style("background-color", "hsl(100, 80%, 45%)")
    };

    static ref TAB_FAVICON_STYLE: String = class! {
        .style("width", &px(TAB_FAVICON_SIZE))
        .style("margin-left", "2px")
        .style("margin-right", "1px")
    };

    static ref TAB_FAVICON_STYLE_UNLOADED: String = class! {
        .style("filter", "grayscale(100%)")
    };

    static ref TAB_TEXT_STYLE: String = class! {
        .style("overflow", "hidden")
        .style("padding-left", "3px")
        .style("padding-right", "1px")
    };

    static ref TAB_CLOSE_STYLE: String = class! {
        .style("box-sizing", "border-box")
        .style("width", "18px")
        .style("border-width", &px(TAB_CLOSE_BORDER_WIDTH))
        .style("padding-left", "1px")
        .style("padding-right", "1px")
    };

    static ref TAB_CLOSE_HOVER_STYLE: String = class! {
        .style("background-color", "hsla(0, 0%, 100%, 0.75)")
        .style("border-color", "hsla(0, 0%, 90%, 0.75) \
                                hsla(0, 0%, 85%, 0.75) \
                                hsla(0, 0%, 85%, 0.75) \
                                hsla(0, 0%, 90%, 0.75)")
    };

    static ref TAB_CLOSE_HOLD_STYLE: String = class! {
        .style("padding-top", "1px")
        .style("background-color", "hsla(0, 0%, 98%, 0.75)")
        .style("border-color", "hsla(0, 0%,  70%, 0.75) \
                                hsla(0, 0%, 100%, 0.75) \
                                hsla(0, 0%, 100%, 0.80) \
                                hsla(0, 0%,  80%, 0.75)")
    };

    static ref DRAGGING_STYLE: String = class! {
        .style("position", "fixed")
        .style("z-index", HIGHEST_ZINDEX)

        .style("left", "0px")
        .style("top", "0px")
        .style("overflow", "visible")
        .style("pointer-events", "none")
        .style("opacity", "0.98")
    };

    static ref URL_BAR_STYLE: String = class! {
        .style("position", "fixed")
        .style("z-index", HIGHEST_ZINDEX)

        .style("box-sizing", "border-box")

        .style("pointer-events", "none")
        .style("left", "0px")
        .style("bottom", "0px")

        .style("max-width", "100%") // calc(100% + 1px)

        .style("border-top-width", "1px")
        .style("border-right-width", "1px")
        .style("border-top-color", "hsl(0, 0%, 45%)")
        .style("border-right-color", "hsl(0, 0%, 40%)")
        .style("border-top-right-radius", "5px")

        .style("padding-right", "2px") // 2px + 3px = 5px
        .style("padding-bottom", "1px")

        .style("color", "black")

        .style("background-color", "white")

        .style("box-shadow", "0px 0px 3px dimgray")
    };

    static ref URL_BAR_TEXT_STYLE: String = class! {
        .style("margin-left", "3px")
        .style("margin-right", "3px")
    };

    static ref URL_BAR_PROTOCOL_STYLE: String = class! {
        .style("font-weight", "bold")
        .style("color", "hsl(120, 100%, 25%)")
    };

    static ref URL_BAR_DOMAIN_STYLE: String = class! {
        .style("font-weight", "bold")
    };

    // TODO remove this ?
    static ref URL_BAR_PATH_STYLE: String = class! {};

    static ref URL_BAR_FILE_STYLE: String = class! {
        .style("font-weight", "bold")
        .style("color", "darkred") // TODO replace with hsl
    };

    static ref URL_BAR_QUERY_STYLE: String = class! {
        .style("font-weight", "bold")
        .style("color", "darkred") // TODO replace with hsl
    };

    static ref URL_BAR_HASH_STYLE: String = class! {
        .style("color", "darkblue") // TODO replace with hsl
    };
}


fn initialize(state: Arc<State>) {
    fn make_url_bar_child<A, D, F>(state: &State, name: &str, mut display: D, f: F) -> Dom
        where A: IntoStr,
              D: FnMut(Arc<url_bar::UrlBar>) -> bool + 'static,
              F: FnMut(Option<Arc<url_bar::UrlBar>>) -> A + 'static {
        html!("div", {
            .class(&URL_BAR_TEXT_STYLE)
            .class(name)

            .mixin(visible(state.url_bar.signal_cloned().map(move |url_bar| {
                if let Some(url_bar) = url_bar {
                    display(url_bar)

                } else {
                    false
                }
            })))

            .children(&mut [
                text_signal(state.url_bar.signal_cloned().map(f))
            ])
        })
    }

    fn tab_favicon<A: Mixin<DomBuilder<HtmlElement>>>(tab: &Tab, mixin: A) -> Dom {
        html!("img", {
            .class(&TAB_FAVICON_STYLE)
            .class(&ICON_STYLE)

            .class_signal(&TAB_FAVICON_STYLE_UNLOADED, tab.unloaded.signal())

            .attribute_signal("src", tab.favicon_url.signal_cloned().map(option_str))

            .mixin(mixin)
        })
    }

    fn tab_text<A: Mixin<DomBuilder<HtmlElement>>>(tab: &Tab, mixin: A) -> Dom {
        html!("div", {
            .class(&STRETCH_STYLE)
            .class(&TAB_TEXT_STYLE)

            .children(&mut [
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
            ])

            .mixin(mixin)
        })
    }

    fn tab_close<A: Mixin<DomBuilder<HtmlElement>>>(tab: &Tab, mixin: A) -> Dom {
        html!("img", {
            .class(&TAB_CLOSE_STYLE)
            .class(&ICON_STYLE)

            .attribute("src", "data/images/button-close.png")

            .mixin(mixin)
        })
    }

    fn tab_template<A>(state: &State, tab: &Tab, favicon: Dom, text: Dom, close: Dom, mixin: A) -> Dom
        where A: Mixin<DomBuilder<HtmlElement>> {

        html!("div", {
            .class(&ROW_STYLE)
            .class(&TAB_STYLE)
            .class(&MENU_ITEM_STYLE)

            .mixin(cursor(state.is_dragging(), "pointer"))

            .class_signal(&TAB_UNLOADED_STYLE, tab.unloaded.signal())
            .class_signal(&TAB_FOCUSED_STYLE, tab.is_focused())

            .children(&mut [favicon, text, close])

            .mixin(mixin)
        })
    }


    stylesheet!("html, body", {
        .style_signal("cursor", state.is_dragging().map(|is_dragging| {
            if is_dragging {
                Some("grabbing")

            } else {
                None
            }
        }))
    });

    dominator::append_dom(&dominator::body(),
        html!("div", {
            .class(&TOP_STYLE)
            .class(&TEXTURE_STYLE)

            // TODO only attach this when dragging
            .global_event(clone!(state => move |_: MouseUpEvent| {
                state.drag_end();
            }))

            // TODO only attach this when dragging
            .global_event(clone!(state => move |e: MouseMoveEvent| {
                state.drag_move(e.client_x(), e.client_y());
            }))

            .global_event(clone!(state => move |_: ResizeEvent| {
                state.update(false);
            }))

            .future(waiter::waiter(&state, clone!(state => move |should_search| {
                state.update(should_search);
            })))

            .children(&mut [
                html!("div", {
                    .class(&DRAGGING_STYLE)

                    .mixin(visible(state.is_dragging()))

                    .style_signal("width", state.dragging.state.signal_ref(|dragging| {
                        if let Some(DragState::Dragging { rect, .. }) = dragging {
                            Some(px(rect.get_width()))

                        } else {
                            None
                        }
                    }))

                    .style_signal("transform", state.dragging.state.signal_ref(|dragging| {
                        if let Some(DragState::Dragging { mouse_y, rect, .. }) = dragging {
                            Some(format!("translate({}px, {}px)", rect.get_left().round(), (mouse_y - TAB_DRAGGING_TOP)))

                        } else {
                            None
                        }
                    }))

                    .children_signal_vec(state.dragging.selected_tabs.signal_ref(clone!(state => move |tabs| {
                        tabs.iter().enumerate().map(|(index, tab)| {
                            // TODO use some sort of oneshot animation instead
                            // TODO don't create the animation at all for index 0
                            let animation = MutableAnimation::new(SELECTED_TABS_ANIMATION_DURATION);

                            if index > 0 {
                                animation.animate_to(Percentage::new(1.0));
                            }

                            Dom::with_state(animation, |animation| {
                                tab_template(&state, &tab,
                                    tab_favicon(&tab, |dom| dom),
                                    tab_text(&tab, |dom| dom),

                                    if index == 0 {
                                        tab_close(&tab, |dom| dom)

                                    } else {
                                        dominator::Dom::empty()
                                    },

                                    |mut dom: DomBuilder<HtmlElement>| {
                                        dom = dom
                                            .class_signal(&TAB_SELECTED_STYLE, tab.selected.signal())
                                            .class(&MENU_ITEM_SHADOW_STYLE)
                                            .style("z-index", &format!("-{}", index));

                                        if index == 0 {
                                            dom = dom
                                                .class(&TAB_HOVER_STYLE)
                                                .class(&MENU_ITEM_HOVER_STYLE)
                                                .class_signal(&TAB_SELECTED_HOVER_STYLE, tab.selected.signal())
                                                .class_signal(&TAB_UNLOADED_HOVER_STYLE, tab.unloaded.signal())
                                                .class_signal(&TAB_FOCUSED_HOVER_STYLE, tab.is_focused());
                                        }

                                        // TODO use ease-out easing
                                        if index > 0 && index < 5 {
                                            dom = dom.style_signal("margin-top", none_if(animation.signal(), 0.0, px_range, 0.0, -(TAB_TOTAL_HEIGHT - 2.0)));

                                        } else if index >= 5 {
                                            dom = dom.style_signal("margin-top", none_if(animation.signal(), 0.0, px_range, 0.0, -TAB_TOTAL_HEIGHT));
                                        }

                                        // TODO use ease-out easing
                                        if index >= 5 {
                                            dom = dom.style_signal("opacity", none_if(animation.signal(), 0.0, float_range, 1.0, 0.0));
                                        }

                                        dom
                                    })
                            })
                        }).collect()
                    })).to_signal_vec())
                }),

                html!("div", {
                    .class(&ROW_STYLE)
                    .class(&URL_BAR_STYLE)

                    .mixin(visible(map_ref! {
                        let is_dragging = state.is_dragging(),
                        let url_bar = state.url_bar.signal_cloned() => {
                            // TODO a bit hacky
                            let matches = url_bar.as_ref().map(|url_bar| {
                                !is_empty(&url_bar.protocol) ||
                                !is_empty(&url_bar.domain) ||
                                !is_empty(&url_bar.path) ||
                                !is_empty(&url_bar.file) ||
                                !is_empty(&url_bar.query) ||
                                !is_empty(&url_bar.hash)
                            }).unwrap_or(false);

                            !is_dragging && matches
                        }
                    }))

                    // TODO check if any of these need "flex-shrink": 1
                    .children(&mut [
                        make_url_bar_child(&state, &URL_BAR_PROTOCOL_STYLE, |x| !is_empty(&x.protocol), |url_bar| option_str_default_fn(url_bar, "", |x| &x.protocol)), // .as_ref().map(|x| x.as_str())
                        make_url_bar_child(&state, &URL_BAR_DOMAIN_STYLE, |x| !is_empty(&x.domain), |url_bar| option_str_default_fn(url_bar, "", |x| &x.domain)),
                        make_url_bar_child(&state, &URL_BAR_PATH_STYLE, |x| !is_empty(&x.path), |url_bar| option_str_default_fn(url_bar, "", |x| &x.path)),
                        make_url_bar_child(&state, &URL_BAR_FILE_STYLE, |x| !is_empty(&x.file), |url_bar| option_str_default_fn(url_bar, "", |x| &x.file)),
                        make_url_bar_child(&state, &URL_BAR_QUERY_STYLE, |x| !is_empty(&x.query), |url_bar| option_str_default_fn(url_bar, "", |x| &x.query)),
                        make_url_bar_child(&state, &URL_BAR_HASH_STYLE, |x| !is_empty(&x.hash), |url_bar| option_str_default_fn(url_bar, "", |x| &x.hash)),
                    ])
                }),

                html!("div", {
                    .class(&ROW_STYLE)
                    .class(&TOOLBAR_STYLE)

                    .children(&mut [
                        html!("input" => InputElement, {
                            .class(&SEARCH_STYLE)
                            .class(&STRETCH_STYLE)

                            .mixin(cursor(state.is_dragging(), "auto"))

                            .attribute("type", "text")
                            .attribute("autofocus", "")
                            .attribute("autocomplete", "off")
                            .attribute("placeholder", "Search")

                            .attribute_signal("title", FAILED.signal_cloned().map(|x| option_str_default(x, "")))

                            .attribute_signal("value", state.search_box.signal_cloned().map(|x| DerefFn::new(x, |x| x.as_str())))

                            .with_element(|dom, element: InputElement| {
                                dom.event(clone!(state => move |_: InputEvent| {
                                    let value = Arc::new(element.raw_value());
                                    stdweb::web::window().local_storage().insert("tab-organizer.search", &value).unwrap();
                                    state.search_parser.set(parse::Parsed::new(&value));
                                    state.search_box.set(value);
                                    state.update(true);
                                }))
                            })
                        }),

                        html!("div", {
                            .class(&TOOLBAR_SEPARATOR_STYLE)
                        }),

                        {
                            let hovering = Mutable::new(false);
                            let holding = Mutable::new(false);

                            html!("div", {
                                .class(&TOOLBAR_MENU_WRAPPER_STYLE)
                                .children(&mut [
                                    html!("div", {
                                        .class(&ROW_STYLE)
                                        .class(&TOOLBAR_MENU_STYLE)

                                        .mixin(cursor(state.is_dragging(), "pointer"))

                                        .class_signal(&TOOLBAR_MENU_HOLD_STYLE, and(hovering.signal(), holding.signal()))

                                        .event(clone!(hovering => move |_: MouseEnterEvent| {
                                            hovering.set_neq(true);
                                        }))

                                        .event(move |_: MouseLeaveEvent| {
                                            hovering.set_neq(false);
                                        })

                                        .event(clone!(holding => move |_: MouseDownEvent| {
                                            holding.set_neq(true);
                                        }))

                                        // TODO only attach this when holding
                                        .global_event(move |_: MouseUpEvent| {
                                            holding.set_neq(false);
                                        })

                                        .event(clone!(state => move |_: ClickEvent| {
                                            state.menu.show();
                                        }))

                                        .children(&mut [
                                            text("Menu"),
                                        ])
                                    }),

                                    state.menu.render(|menu| { menu
                                        .submenu("Sort tabs by...", |menu| { menu
                                            .option("Window", state.options.sort_tabs.signal_ref(|x| *x == SortTabs::Window), clone!(state => move || {
                                                state.options.sort_tabs.set_neq(SortTabs::Window);
                                            }))

                                            .option("Tag", state.options.sort_tabs.signal_ref(|x| *x == SortTabs::Tag), clone!(state => move || {
                                                state.options.sort_tabs.set_neq(SortTabs::Tag);
                                            }))

                                            .separator()

                                            .option("Time (focused)", state.options.sort_tabs.signal_ref(|x| *x == SortTabs::TimeFocused), clone!(state => move || {
                                                state.options.sort_tabs.set_neq(SortTabs::TimeFocused);
                                            }))

                                            .option("Time (created)", state.options.sort_tabs.signal_ref(|x| *x == SortTabs::TimeCreated), clone!(state => move || {
                                                state.options.sort_tabs.set_neq(SortTabs::TimeCreated);
                                            }))

                                            .separator()

                                            .option("URL", state.options.sort_tabs.signal_ref(|x| *x == SortTabs::Url), clone!(state => move || {
                                                state.options.sort_tabs.set_neq(SortTabs::Url);
                                            }))

                                            .option("Name", state.options.sort_tabs.signal_ref(|x| *x == SortTabs::Name), clone!(state => move || {
                                                state.options.sort_tabs.set_neq(SortTabs::Name);
                                            }))
                                        })

                                        .separator()

                                        .submenu("Foo", |menu| { menu
                                            .option("Bar", futures_signals::signal::always(true), || {})
                                            .option("Qux", futures_signals::signal::always(false), || {})
                                        })
                                    }),
                                ])
                            })
                        },
                    ])
                }),

                html!("div", {
                    .class(&GROUP_LIST_STYLE)

                    .with_element(|dom, element: HtmlElement| { dom
                        // TODO also update these when groups/tabs are added/removed ?
                        .event(clone!(state, element => move |_: ScrollEvent| {
                            if IS_LOADED.get() {
                                let local_storage = stdweb::web::window().local_storage();
                                let y = element.scroll_top();
                                // TODO is there a more efficient way of converting to a string ?
                                local_storage.insert("tab-organizer.scroll.y", &y.to_string()).unwrap();
                                state.scrolling.y.set_neq(y);
                                state.update(false);
                            }
                        }))

                        // TODO use set_scroll_top instead
                        .future(map_ref! {
                            let loaded = IS_LOADED.signal(),
                            let scroll_y = state.scrolling.y.signal() => {
                                if *loaded {
                                    Some(*scroll_y)

                                } else {
                                    None
                                }
                            }
                        // TODO super hacky, figure out a better way to keep the scroll_y in bounds
                        }.for_each(clone!(state => move |scroll_y| {
                            if let Some(scroll_y) = scroll_y {
                                let scroll_y = scroll_y.round();
                                let old_scroll_y = element.scroll_top();

                                if old_scroll_y != scroll_y {
                                    element.set_scroll_top(scroll_y);

                                    // TODO does this cause a reflow ?
                                    let new_scroll_y = element.scroll_top();

                                    if new_scroll_y != scroll_y {
                                        state.scrolling.y.set_neq(new_scroll_y);
                                    }

                                    state.update(false);
                                }
                            }

                            Ok(())
                        })))
                    })

                    .children(&mut [
                        // TODO this is pretty hacky, but I don't know a better way to make it work
                        html!("div", {
                            .class(&GROUP_LIST_CHILDREN_STYLE)

                            .style_signal("padding-top", state.groups_padding.signal().map(px))
                            .style_signal("height", state.scrolling.height.signal().map(px))

                            .children_signal_vec(state.groups.signal_vec_cloned().enumerate()
                                //.delay_remove(|(_, group)| waiter::delay_animation(&group.insert_animation, &group.visible))
                                .filter_signal_cloned(|(_, group)| group.visible.signal())
                                .map(clone!(state => move |(index, group)| {
                                    if let Some(index) = index.get() {
                                        if state.should_be_dragging_group(index) {
                                            group.drag_top.jump_to(Percentage::new(1.0));
                                        }
                                    }

                                    html!("div", {
                                        .class(&GROUP_STYLE)

                                        .style_signal("top", none_if(group.drag_top.signal(), 0.0, px_range, -1.0, DRAG_GAP_PX - 1.0))
                                        .style_signal("padding-bottom", none_if(group.drag_over.signal(), 0.0, px_range, 0.0, DRAG_GAP_PX))
                                        .style_signal("margin-bottom", none_if(group.drag_over.signal(), 0.0, px_range, 0.0, -DRAG_GAP_PX))

                                        .style_signal("padding-top", none_if(group.insert_animation.signal(), 1.0, px_range, 0.0, GROUP_PADDING_TOP))
                                        .style_signal("border-top-width", none_if(group.insert_animation.signal(), 1.0, px_range, 0.0, GROUP_BORDER_WIDTH))
                                        .style_signal("opacity", none_if(group.insert_animation.signal(), 1.0, float_range, 0.0, 1.0))

                                        .event(clone!(state, group, index => move |_: MouseEnterEvent| {
                                            if let Some(index) = index.get() {
                                                state.drag_over_group(group.clone(), index);
                                            }
                                        }))

                                        .children(&mut [
                                            if group.show_header {
                                                html!("div", {
                                                    .class(&ROW_STYLE)
                                                    .class(&GROUP_HEADER_STYLE)

                                                    .style_signal("height", none_if(group.insert_animation.signal(), 1.0, px_range, 0.0, GROUP_HEADER_HEIGHT))
                                                    .style_signal("margin-left", none_if(group.insert_animation.signal(), 1.0, px_range, INSERT_LEFT_MARGIN, 0.0))

                                                    .children(&mut [
                                                        html!("div", {
                                                            .class(&GROUP_HEADER_TEXT_STYLE)
                                                            .class(&STRETCH_STYLE)
                                                            .children(&mut [
                                                                text_signal(map_ref! {
                                                                        let name = group.name.signal_cloned(),
                                                                        let index = index.signal() => {
                                                                            // TODO improve the efficiency of this ?
                                                                            name.clone().or_else(|| {
                                                                                index.map(|index| Arc::new((index + 1).to_string()))
                                                                            })
                                                                        }
                                                                    }
                                                                    // This causes it to remember the previous value if it returns `None`
                                                                    // TODO dedicated method for this ?
                                                                    .filter_map(|x| x)
                                                                    .map(|x| option_str_default(x, ""))),
                                                            ])
                                                        }),
                                                    ])
                                                })

                                            } else {
                                                Dom::empty()
                                            },

                                            html!("div", {
                                                .class(&GROUP_TABS_STYLE)

                                                .style_signal("padding-top", group.tabs_padding.signal().map(px))
                                                .style_signal("padding-bottom", none_if(group.insert_animation.signal(), 1.0, px_range, 0.0, GROUP_PADDING_BOTTOM))

                                                .children_signal_vec(group.tabs.signal_vec_cloned().enumerate()
                                                    //.delay_remove(|(_, tab)| waiter::delay_animation(&tab.insert_animation, &tab.visible))
                                                    .filter_signal_cloned(|(_, tab)| tab.visible.signal())
                                                    .map(clone!(state => move |(index, tab)| {
                                                        if let Some(index) = index.get() {
                                                            if state.should_be_dragging_tab(group.id, index) {
                                                                tab.drag_over.jump_to(Percentage::new(1.0));
                                                            }
                                                        }

                                                        tab_template(&state, &tab,
                                                            tab_favicon(&tab, |dom: DomBuilder<HtmlElement>| { dom
                                                                .style_signal("height", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_FAVICON_SIZE))
                                                            }),

                                                            tab_text(&tab, |dom: DomBuilder<HtmlElement>| { dom }),

                                                            tab_close(&tab, |dom: DomBuilder<HtmlElement>| { dom
                                                                .class_signal(&TAB_CLOSE_HOVER_STYLE, tab.close_hovered.signal())
                                                                .class_signal(&TAB_CLOSE_HOLD_STYLE, and(tab.close_hovered.signal(), tab.close_holding.signal()))

                                                                .style_signal("height", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_FAVICON_SIZE))
                                                                .style_signal("border-top-width", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_CLOSE_BORDER_WIDTH))
                                                                .style_signal("border-bottom-width", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_CLOSE_BORDER_WIDTH))

                                                                .mixin(visible(state.is_tab_hovered(&tab)))

                                                                .event(clone!(tab => move |_: MouseEnterEvent| {
                                                                    tab.close_hovered.set_neq(true);
                                                                }))

                                                                .event(clone!(tab => move |_: MouseLeaveEvent| {
                                                                    tab.close_hovered.set_neq(false);
                                                                }))

                                                                .event(clone!(tab => move |_: MouseDownEvent| {
                                                                    tab.close_holding.set_neq(true);
                                                                }))

                                                                // TODO only attach this when hovering
                                                                .global_event(clone!(tab => move |_: MouseUpEvent| {
                                                                    tab.close_holding.set_neq(false);
                                                                }))
                                                            }),

                                                            |dom: DomBuilder<HtmlElement>| dom
                                                                .class_signal(&TAB_HOVER_STYLE, state.is_tab_hovered(&tab))
                                                                .class_signal(&MENU_ITEM_HOVER_STYLE, state.is_tab_hovered(&tab))
                                                                .class_signal(&TAB_UNLOADED_HOVER_STYLE, and(state.is_tab_hovered(&tab), tab.unloaded.signal()))
                                                                .class_signal(&TAB_FOCUSED_HOVER_STYLE, and(state.is_tab_hovered(&tab), tab.is_focused()))

                                                                .class_signal(&TAB_HOLD_STYLE, state.is_tab_holding(&tab))
                                                                .class_signal(&MENU_ITEM_HOLD_STYLE, state.is_tab_holding(&tab))

                                                                .class_signal(&TAB_SELECTED_STYLE, tab.selected.signal())
                                                                .class_signal(&TAB_SELECTED_HOVER_STYLE, and(state.is_tab_hovered(&tab), tab.selected.signal()))
                                                                .class_signal(&MENU_ITEM_SHADOW_STYLE, or(state.is_tab_hovered(&tab), tab.selected.signal()))

                                                                .attribute_signal("title", tab.title.signal_cloned().map(|x| option_str_default(x, "")))

                                                                .style_signal("margin-left", none_if(tab.insert_animation.signal(), 1.0, px_range, INSERT_LEFT_MARGIN, 0.0))
                                                                .style_signal("height", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_HEIGHT))
                                                                .style_signal("padding-top", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_PADDING))
                                                                .style_signal("padding-bottom", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_PADDING))
                                                                .style_signal("border-top-width", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_BORDER_WIDTH))
                                                                .style_signal("border-bottom-width", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_BORDER_WIDTH))
                                                                .style_signal("opacity", none_if(tab.insert_animation.signal(), 1.0, float_range, 0.0, 1.0))

                                                                .style_signal("transform", tab.insert_animation.signal().map(|t| {
                                                                    t.none_if(1.0).map(|t| format!("rotateX({}deg)", ease(t).range_inclusive(-90.0, 0.0)))
                                                                }))

                                                                .style_signal("top", none_if(tab.drag_over.signal(), 0.0, px_range, 0.0, DRAG_GAP_PX))

                                                                // TODO a bit hacky
                                                                .with_element(|dom, element: HtmlElement| {
                                                                    dom.event(clone!(state, index, group, tab => move |e: MouseDownEvent| {
                                                                        tab.holding.set_neq(true);

                                                                        if let Some(index) = index.get() {
                                                                            let shift = e.shift_key();
                                                                            // TODO is this correct ?
                                                                            // TODO test this, especially on Mac
                                                                            // TODO what if both of these are true ?
                                                                            let ctrl = e.ctrl_key() || e.meta_key();
                                                                            let alt = e.alt_key();

                                                                            if !shift && !ctrl && !alt {
                                                                                let rect = element.get_bounding_client_rect();
                                                                                state.drag_start(e.client_x(), e.client_y(), rect, group.clone(), tab.clone(), index);
                                                                            }
                                                                        }
                                                                    }))
                                                                })

                                                                // TODO only attach this when holding
                                                                .global_event(clone!(tab => move |_: MouseUpEvent| {
                                                                    tab.holding.set_neq(false);
                                                                }))

                                                                .event(clone!(state, index, group, tab => move |_: MouseEnterEvent| {
                                                                    // TODO should this be inside of the if ?
                                                                    state.hover_tab(&tab);

                                                                    if let Some(index) = index.get() {
                                                                        state.drag_over(group.clone(), index);
                                                                    }
                                                                }))

                                                                .event(clone!(state, tab => move |_: MouseLeaveEvent| {
                                                                    // TODO should this check the index, like MouseEnterEvent ?
                                                                    state.unhover_tab(&tab);
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
                                                                            MouseButton::Left => {
                                                                                // TODO a little hacky
                                                                                if !tab.close_hovered.get() {
                                                                                    if ctrl && !shift && !alt {
                                                                                        group.ctrl_select_tab(&tab);

                                                                                    } else if !ctrl && shift && !alt {
                                                                                        group.shift_select_tab(&tab);

                                                                                    } else if !ctrl && !shift && !alt {
                                                                                        group.click_tab(&tab);
                                                                                    }
                                                                                }
                                                                            },
                                                                            _ => {},
                                                                        }
                                                                    }
                                                                })))
                                                    })))
                                            }),
                                        ])
                                    })
                                })))
                        }),
                    ])
                }),
            ])
        }),
    );

    // TODO a little hacky, needed to ensure that scrolling happens after everything is created
    stdweb::web::window().request_animation_frame(|_| {
        IS_LOADED.set_neq(true);
        log!("Loaded");
    });

    log!("Finished");


    js! { @(no_return)
        setInterval(@{clone!(state => move || {
            state.process_message(SidebarMessage::TabChanged {
                tab_index: 2,
                change: TabChange::Title {
                    new_title: Some(generate_uuid().to_string()),
                },
            });

            /*state.process_message(SidebarMessage::TabChanged {
                tab_index: 0,
                change: TabChange::Pinned {
                    pinned: false,
                },
            });*/

            state.process_message(SidebarMessage::TabRemoved {
                tab_index: 0,
            });

            state.process_message(SidebarMessage::TabRemoved {
                tab_index: 8,
            });

            /*state.process_message(SidebarMessage::TabInserted {
                tab_index: 0,
                tab: state::Tab {
                    serialized: state::SerializedTab {
                        id: generate_uuid(),
                        timestamp_created: Date::now()
                    },
                    focused: false,
                    unloaded: true,
                    pinned: true,
                    favicon_url: Some("http://www.saltybet.com/favicon.ico".to_owned()),
                    url: Some("top".to_owned()),
                    title: Some("top".to_owned()),
                },
            });*/

            state.process_message(SidebarMessage::TabInserted {
                tab_index: 12,
                tab: state::Tab {
                    serialized: state::SerializedTab {
                        id: generate_uuid(),
                        timestamp_created: Date::now()
                    },
                    focused: false,
                    unloaded: true,
                    pinned: false,
                    favicon_url: Some("http://www.saltybet.com/favicon.ico".to_owned()),
                    url: Some("bottom".to_owned()),
                    title: Some("bottom".to_owned()),
                },
            });

            /*for _ in 0..10 {
                state.process_message(SidebarMessage::TabRemoved {
                    window_index: 2,
                    tab_index: 0,
                });
            }

            state.process_message(SidebarMessage::WindowRemoved {
                window_index: 2,
            });

            state.process_message(SidebarMessage::WindowInserted {
                window_index: 2,
                window: state::Window {
                    serialized: state::SerializedWindow {
                        id: generate_uuid(),
                        name: None,
                        timestamp_created: Date::now(),
                    },
                    focused: false,
                    tabs: vec![],
                },
            });

            for index in 0..10 {
                state.process_message(SidebarMessage::TabInserted {
                    window_index: 2,
                    tab_index: index,
                    tab: state::Tab {
                        serialized: state::SerializedTab {
                            id: generate_uuid(),
                            timestamp_created: Date::now(),
                        },
                        focused: index == 7,
                        unloaded: index == 5,
                        pinned: index == 0 || index == 1 || index == 2,
                        favicon_url: Some("http://www.saltybet.com/favicon.ico".to_owned()),
                        url: Some("https://www.example.com/foo?bar#qux".to_owned()),
                        title: Some("Foo".to_owned()),
                    },
                });
            }*/
        })}, @{INSERT_ANIMATION_DURATION + 2000.0});
    }

    js! { @(no_return)
        setInterval(@{move || {
            state.process_message(SidebarMessage::TabInserted {
                tab_index: 0,
                tab: state::Tab {
                    serialized: state::SerializedTab {
                        id: generate_uuid(),
                        timestamp_created: Date::now()
                    },
                    focused: false,
                    unloaded: true,
                    pinned: true,
                    favicon_url: Some("http://www.saltybet.com/favicon.ico".to_owned()),
                    url: Some("top".to_owned()),
                    title: Some("top".to_owned()),
                },
            });
        }}, @{INSERT_ANIMATION_DURATION + 11000.0});
    }
}


fn main() {
    tab_organizer::set_panic_hook(|message| {
        let message = Arc::new(message);
        FAILED.set(Some(message.clone()));
        PromiseFuture::print_error_panic(&*message);
    });


    log!("Starting");

    stylesheet!("*", {
        .style("text-overflow", "ellipsis")

        .style("vertical-align", "middle") /* TODO I can probably get rid of this */

        /* TODO is this correct ?*/
        .style("background-repeat", "no-repeat")
        .style("background-size", "100% 100%")
        .style("cursor", "inherit")
        .style("position", "relative")

        /* TODO are these a good idea ? */
        .style("outline-width", "0px")
        .style("outline-color", "transparent")
        .style("outline-style", "solid")

        .style("border-width", "0px")
        .style("border-color", "transparent")
        .style("border-style", "solid")

        .style("margin", "0px")
        .style("padding", "0px")

        .style("background-color", "transparent")

        .style("flex-shrink", "0") /* 1 */
        .style("flex-grow", "0") /* 1 */
        .style("flex-basis", "auto") /* 0% */ /* TODO try out other stuff like min-content once it becomes available */
    });

    stylesheet!("html, body", {
        .style("width", "100%")
        .style("height", "100%")

        .style(["-moz-user-select", "user-select"], "none")
    });

    // Disables the browser scroll restoration
    js! { @(no_return)
        if ("scrollRestoration" in history) {
            history.scrollRestoration = "manual";
        }
    }

    dominator::append_dom(&dominator::body(), {
        let show = Mutable::new(false);

        set_timeout(clone!(show => move || {
            show.set_neq(true);
        }), LOADING_MESSAGE_THRESHOLD);

        html!("div", {
            .class(&TOP_STYLE)
            .class(&TEXTURE_STYLE)

            .mixin(visible(not(IS_LOADED.signal())))

            .children(&mut [
                html!("div", {
                    .class(&MODAL_STYLE)
                    .class(&CENTER_STYLE)
                    .class(&LOADING_STYLE)

                    .mixin(visible(and(show.signal(), not(IS_LOADED.signal()))))

                    .children(&mut [
                        text("LOADING..."),
                    ])
                })
            ])
        })
    });


    js! { @(no_return)
        setTimeout(@{move || {
            let window: state::Window = state::Window {
                serialized: state::SerializedWindow {
                    id: generate_uuid(),
                    name: None,
                    timestamp_created: Date::now(),
                },
                focused: false,
                tabs: (0..100).map(|index| {
                    state::Tab {
                        serialized: state::SerializedTab {
                            id: generate_uuid(),
                            timestamp_created: Date::now(),
                        },
                        focused: index == 7,
                        unloaded: index == 5,
                        pinned: index == 0 || index == 1 || index == 2,
                        favicon_url: Some("http://www.saltybet.com/favicon.ico".to_owned()),
                        url: Some("https://www.example.com/foo?bar#qux".to_owned()),
                        title: Some("Foo".to_owned()),
                    }
                }).collect(),
            };

            initialize(Arc::new(State::new(Options::new(), window)));
        }}, 1500);
    }
}
