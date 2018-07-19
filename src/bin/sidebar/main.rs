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
use std::sync::atomic::{AtomicUsize, Ordering};
use tab_organizer::{generate_uuid, and, or, not, normalize, ScrollEvent};
use tab_organizer::state;
use tab_organizer::state::{Message, TabChange};
use dominator::traits::*;
use dominator::{Dom, DomBuilder, text, text_signal, HIGHEST_ZINDEX, DerefFn};
use dominator::animation::{Percentage, MutableAnimation, OnTimestampDiff};
use dominator::animation::easing;
use dominator::events::{MouseDownEvent, MouseEnterEvent, InputEvent, MouseLeaveEvent, MouseMoveEvent, MouseUpEvent, MouseButton, IMouseEvent, ResizeEvent, ClickEvent};
use stdweb::PromiseFuture;
use stdweb::web::{Date, HtmlElement, Rect, IElement, IHtmlElement, window, set_timeout};
use stdweb::web::html_element::InputElement;
use futures_signals::signal::{Signal, IntoSignal, Mutable, SignalExt};
use futures_signals::signal_vec::{MutableVec, SignalVecExt};
use uuid::Uuid;
use menu::Menu;

mod parse;
mod waiter;
mod url_bar;
mod menu;


const LOADING_MESSAGE_THRESHOLD: u32 = 500;

const MOUSE_SCROLL_THRESHOLD: f64 = 30.0; // Number of pixels before it starts scrolling
const MOUSE_SCROLL_SPEED: f64 = 0.5; // Number of pixels to move per millisecond

const INSERT_ANIMATION_DURATION: f64 = 600.0;
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


// TODO this is a common option
#[derive(Debug, Copy, Clone, PartialEq, Eq)]
enum SortTabs {
    Window,
    Tag,
    TimeFocused,
    TimeCreated,
    Url,
    Name,
}


struct Options {
    sort_tabs: Mutable<SortTabs>,
}

impl Options {
    fn new() -> Self {
        Self {
            sort_tabs: Mutable::new(SortTabs::Window),
        }
    }
}


struct Window {
    id: Uuid,
    name: Mutable<Option<Arc<String>>>,
    tabs: Vec<Arc<Tab>>,
}

impl Window {
    fn new(state: state::Window) -> Self {
        Self {
            id: state.serialized.id,
            name: Mutable::new(state.serialized.name.map(Arc::new)),
            tabs: state.tabs.into_iter().map(|tab| Arc::new(Tab::new(tab))).collect(),
        }
    }
}


struct Group {
    id: usize,
    name: Mutable<Option<Arc<String>>>,
    tabs: MutableVec<Arc<Tab>>,

    insert_animation: MutableAnimation,
    removing: Mutable<bool>,
    visible: Mutable<bool>,

    matches_search: Mutable<bool>,

    last_selected_tab: Mutable<Option<Arc<Tab>>>,

    drag_over: MutableAnimation,
    drag_top: MutableAnimation,
    tabs_padding: Mutable<f64>, // TODO use u32 instead ?
}

impl Group {
    fn new(window: &Window, tabs: Vec<Arc<Tab>>) -> Self {
        lazy_static! {
            static ref ID_COUNTER: AtomicUsize = AtomicUsize::new(0);
        }

        Self {
            // TODO investigate whether it's possible to use a faster Ordering
            id: ID_COUNTER.fetch_add(1, Ordering::SeqCst),
            name: window.name.clone(),
            tabs: MutableVec::new_with_values(tabs),
            drag_over: MutableAnimation::new(DRAG_ANIMATION_DURATION),
            drag_top: MutableAnimation::new(DRAG_ANIMATION_DURATION),
            insert_animation: MutableAnimation::new_with_initial(INSERT_ANIMATION_DURATION, Percentage::new(1.0)),
            last_selected_tab: Mutable::new(None),
            matches_search: Mutable::new(false),
            removing: Mutable::new(false),
            visible: Mutable::new(false),
            tabs_padding: Mutable::new(0.0),
        }
    }

    fn insert_animate(&self) {
        self.insert_animation.jump_to(Percentage::new(0.0));
        self.insert_animation.animate_to(Percentage::new(1.0));
    }

    fn remove_animate(&self) {
        self.removing.set_neq(true);
        self.insert_animation.animate_to(Percentage::new(0.0));
    }

    fn is_inserted(this: &Arc<Self>) -> bool {
        !this.removing.get()
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
        if !tab.selected.get() {
            {
                let tabs = self.tabs.lock_slice();

                for tab in tabs.iter() {
                    tab.selected.set_neq(false);
                }
            }

            self.last_selected_tab.set_neq(None);
        }
    }

    fn ctrl_select_tab(&self, tab: &Arc<Tab>) {
        let mut selected = tab.selected.lock_mut();

        *selected = !*selected;

        if *selected {
            self.last_selected_tab.set_neq(Some(tab.clone()));

        } else {
            self.last_selected_tab.set_neq(None);
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
                    x.selected.set_neq(true);

                    if tab.id != last_selected_tab.id {
                        seen = !seen;
                    }

                } else if seen {
                    x.selected.set_neq(true);

                } else {
                    x.selected.set_neq(false);
                }
            }

            true

        } else {
            false
        };

        if !selected {
            tab.selected.set_neq(true);
            *last_selected_tab = Some(tab.clone());
        }
    }
}


struct Tab {
    id: Uuid,
    favicon_url: Mutable<Option<Arc<String>>>,
    title: Mutable<Option<Arc<String>>>,
    url: Mutable<Option<Arc<String>>>,
    focused: Mutable<bool>,
    unloaded: Mutable<bool>,
    pinned: Mutable<bool>,

    selected: Mutable<bool>,
    dragging: Mutable<bool>,

    hovered: Mutable<bool>,
    holding: Mutable<bool>,

    close_hovered: Mutable<bool>,
    close_holding: Mutable<bool>,

    matches_search: Mutable<bool>,

    removing: Mutable<bool>,
    visible: Mutable<bool>,

    drag_over: MutableAnimation,
    insert_animation: MutableAnimation,
}

impl Tab {
    fn new(state: state::Tab) -> Self {
        Self {
            id: state.serialized.id,
            favicon_url: Mutable::new(state.favicon_url.map(Arc::new)),
            title: Mutable::new(state.title.map(Arc::new)),
            url: Mutable::new(state.url.map(Arc::new)),
            focused: Mutable::new(state.focused),
            unloaded: Mutable::new(state.unloaded),
            pinned: Mutable::new(state.pinned),
            selected: Mutable::new(false),
            dragging: Mutable::new(false),
            hovered: Mutable::new(false),
            holding: Mutable::new(false),
            close_hovered: Mutable::new(false),
            close_holding: Mutable::new(false),
            matches_search: Mutable::new(false),
            removing: Mutable::new(false),
            visible: Mutable::new(false),
            drag_over: MutableAnimation::new(DRAG_ANIMATION_DURATION),
            insert_animation: MutableAnimation::new_with_initial(INSERT_ANIMATION_DURATION, Percentage::new(1.0)),
        }
    }

    fn insert_animate(&self) {
        // TODO what if the tab is in multiple groups ?
        self.insert_animation.jump_to(Percentage::new(0.0));
        self.insert_animation.animate_to(Percentage::new(1.0));
    }

    fn remove_animate(&self) {
        self.removing.set_neq(true);
        self.insert_animation.animate_to(Percentage::new(0.0));
    }

    fn is_inserted(this: &Arc<Self>) -> bool {
        !this.removing.get()
    }

    fn is_hovered(&self) -> impl Signal<Item = bool> {
        and(self.hovered.signal(), not(STATE.is_dragging()))
    }

    fn is_holding(&self) -> impl Signal<Item = bool> {
        and(
            and(self.is_hovered(), self.holding.signal()),
            // TODO a little bit hacky
            not(self.close_hovered.signal())
        )
    }

    fn is_focused(&self) -> impl Signal<Item = bool> {
        self.focused.signal()
    }
}

impl PartialEq for Tab {
    #[inline]
    fn eq(&self, other: &Tab) -> bool {
        self.id == other.id
    }
}

impl Eq for Tab {}


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
    options: Options,

    search_box: Mutable<Arc<String>>,
    search_parser: Mutable<parse::Parsed>,

    url_bar: Mutable<Option<Arc<url_bar::UrlBar>>>,
    groups_padding: Mutable<f64>, // TODO use u32 instead ?

    failed: Mutable<Option<Arc<String>>>,
    is_loaded: Mutable<bool>,

    windows: RwLock<Vec<Window>>,
    groups: MutableVec<Arc<Group>>,

    dragging: Dragging,
    scrolling: Scrolling,

    menu: Menu,
}

impl State {
    fn new() -> Self {
        let local_storage = window().local_storage();

        let search_value = local_storage.get("tab-organizer.search").unwrap_or_else(|| "".to_string());
        let scroll_y = local_storage.get("tab-organizer.scroll.y").map(|value| value.parse().unwrap()).unwrap_or(0.0);

        Self {
            options: Options::new(),

            search_parser: Mutable::new(parse::Parsed::new(&search_value)),
            search_box: Mutable::new(Arc::new(search_value)),

            url_bar: Mutable::new(None),
            groups_padding: Mutable::new(0.0),

            failed: Mutable::new(None),

            is_loaded: Mutable::new(false),

            windows: RwLock::new(vec![]),

            groups: MutableVec::new(),

            dragging: Dragging::new(),
            scrolling: Scrolling::new(scroll_y),

            menu: Menu::new(),
        }
    }

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
        let bottom = window().inner_height() as f64;
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
                        group.tabs.lock_slice().iter()
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
        let groups = self.groups.lock_slice();

        // TODO is this correct ?
        // TODO pass in the new_group_index as a function argument
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
                    self.change_groups(&group, &new_group);

                    let old_group_index = Self::find_group_index(&groups, group.id);

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

    fn drag_over_group(&self, new_group: Arc<Group>, new_group_index: usize) {
        let mut dragging = self.dragging.state.lock_mut();

        // TODO verify that this doesn't notify if it isn't dragging
        if let Some(DragState::Dragging { ref mut group, ref mut tab_index, .. }) = *dragging {
            let new_tab_index = if new_group.id == group.id {
                // TODO it shouldn't notify dragging
                return;

            } else {
                self.change_groups(&group, &new_group);

                let groups = self.groups.lock_slice();

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
                let groups = self.groups.lock_slice();

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

    /*fn is_dragging_group(&self, group_id: usize) -> impl Signal<Item = bool> {
        self.dragging.state.signal_ref(move |dragging| {
            if let Some(DragState::Dragging { group, .. }) = dragging {
                group.id == group_id

            } else {
                false
            }
        })
    }*/

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
        let bottom_y = top_y + (window().inner_height() as f64 - TOOLBAR_TOTAL_HEIGHT);

        let mut padding: Option<f64> = None;
        let mut current_height: f64 = 0.0;

        self.groups.retain(|group| {
            if group.removing.get() && group.insert_animation.current_percentage() == Percentage::new(0.0) {
                false

            } else {
                let mut matches_search = false;

                let old_height = current_height;

                let mut tabs_padding: Option<f64> = None;

                let percentage = ease(group.insert_animation.current_percentage()).into_f64();
                //let percentage: f64 = 1.0;

                // TODO hacky
                // TODO what about when it's dragging ?
                // TODO use range_inclusive
                current_height +=
                    (GROUP_BORDER_WIDTH * percentage).round() +
                    (GROUP_PADDING_TOP * percentage).round() +
                    (GROUP_HEADER_HEIGHT * percentage).round();

                let tabs_height = current_height;

                // TODO what if there aren't any tabs in the group ?
                group.tabs.retain(|tab| {
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

                                let percentage = ease(tab.insert_animation.current_percentage()).into_f64();

                                // TODO hacky
                                // TODO take into account the padding/border as well ?
                                // TODO use range_inclusive
                                current_height +=
                                    (TAB_BORDER_WIDTH * percentage).round() +
                                    (TAB_PADDING * percentage).round() +
                                    (TAB_HEIGHT * percentage).round() +
                                    (TAB_PADDING * percentage).round() +
                                    (TAB_BORDER_WIDTH * percentage).round();

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

                    // TODO hacky
                    // TODO what about when it's dragging ?
                    current_height += (GROUP_PADDING_BOTTOM * percentage).round();

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


    fn initialize(&self, initial_windows: Vec<state::Window>) {
        let mut windows = self.windows.write().unwrap();

        *windows = initial_windows.into_iter().map(Window::new).collect();

        self.groups.replace_cloned(windows.iter().map(|window| {
            Arc::new(Group::new(&window, window.tabs.clone()))
        }).collect());
    }

    fn insert_window(&self, window_index: usize, window: &Window) {
        let tabs = window.tabs.clone();

        for tab in tabs.iter() {
            tab.insert_animate();
        }

        let group = Arc::new(Group::new(&window, tabs));

        group.insert_animate();

        let group_index = get_index(self.groups.lock_slice().iter(), window_index, Group::is_inserted);

        self.groups.insert_cloned(group_index, group);
    }

    fn remove_window(&self, window_index: usize, _window: &Window) {
        let groups = self.groups.lock_slice();

        let group_index = get_index(groups.iter(), window_index, Group::is_inserted);

        groups[group_index].remove_animate();
    }

    fn insert_tab(&self, window_index: usize, tab_index: usize, tab: Arc<Tab>) {
        let groups = self.groups.lock_slice();

        let group_index = get_index(groups.iter(), window_index, Group::is_inserted);

        let group = &groups[group_index];

        tab.insert_animate();

        let tab_index = get_index(group.tabs.lock_slice().iter(), tab_index, Tab::is_inserted);

        group.tabs.insert_cloned(tab_index, tab);
    }

    fn remove_tab(&self, window_index: usize, tab_index: usize, _tab: &Tab) {
        let groups = self.groups.lock_slice();

        let group_index = get_index(groups.iter(), window_index, Group::is_inserted);

        let tabs = groups[group_index].tabs.lock_slice();

        let tab_index = get_index(tabs.iter(), tab_index, Tab::is_inserted);

        tabs[tab_index].remove_animate();
    }

    fn process_message(&self, message: Message) {
        match message {
            Message::WindowInserted { window_index, window } => {
                let mut windows = self.windows.write().unwrap();

                let window = Window::new(window);

                self.insert_window(window_index, &window);

                windows.insert(window_index, window);
            },

            Message::WindowRemoved { window_index } => {
                let mut windows = self.windows.write().unwrap();

                let window = windows.remove(window_index);

                self.remove_window(window_index, &window);
            },

            Message::TabInserted { window_index, tab_index, tab } => {
                let mut windows = self.windows.write().unwrap();

                let tab = Arc::new(Tab::new(tab));

                self.insert_tab(window_index, tab_index, tab.clone());

                windows[window_index].tabs.insert(tab_index, tab);
            },

            Message::TabRemoved { window_index, tab_index } => {
                let mut windows = self.windows.write().unwrap();

                let tab = windows[window_index].tabs.remove(tab_index);

                self.remove_tab(window_index, tab_index, &tab);
            },

            Message::TabChanged { window_index, tab_index, change } => {
                let windows = self.windows.read().unwrap();

                let tab = &windows[window_index].tabs[tab_index];

                match change {
                    TabChange::Title { new_title } => {
                        tab.title.set(new_title.map(Arc::new));
                    },
                    TabChange::Pinned { pinned } => {
                        tab.pinned.set_neq(pinned);
                    },
                }
            },
        }
    }
}


lazy_static! {
    static ref STATE: Arc<State> = Arc::new(State::new());

    static ref TOP_STYLE: String = class! {
        .style("white-space", "pre")
        .style("font-family", "sans-serif")
        .style("font-size", "13px")
        .style("width", "300px") // 100%
        .style("height", "100%")
        .style("background-color", "hsl(0, 0%, 100%)")
        .style("overflow", "hidden")
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

    static ref TEXTURE_STYLE: String = class! {
        .style("background-image", "repeating-linear-gradient(0deg, \
                                        transparent                0px, \
                                        hsla(200, 30%, 30%, 0.022) 2px, \
                                        hsla(200, 30%, 30%, 0.022) 3px)")
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

        .style_signal("cursor", STATE.is_dragging().map(|is_dragging| {
            if is_dragging {
                None

            } else {
                Some("pointer")
            }
        }))
    };

    static ref TOOLBAR_MENU_HOLD_STYLE: String = class! {
        .style("top", "1px")
    };

    static ref SEARCH_STYLE: String = class! {
        .style_signal("cursor", STATE.is_dragging().map(|is_dragging| {
            if is_dragging {
                None

            } else {
                Some("auto")
            }
        }))

        .style("padding-top", "2px")
        .style("padding-bottom", "2px")
        .style("padding-left", "5px")
        .style("padding-right", "5px")
        .style("height", "100%")

        .style_signal("background-color", STATE.failed.signal_cloned().map(|failed| {
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

        .style_signal("cursor", STATE.is_dragging().map(|is_dragging| {
            if is_dragging {
                None

            } else {
                Some("pointer")
            }
        }))
    };

    static ref MENU_ITEM_SHADOW_STYLE: String = class! {
        .style("box-shadow", "      1px 1px  1px hsla(0, 0%,   0%, 0.25), \
                              inset 0px 0px  3px hsla(0, 0%, 100%, 1   ), \
                              inset 0px 0px 10px hsla(0, 0%, 100%, 0.25)")
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

    static ref ROW_STYLE: String = class! {
        .style("display", "flex")
        .style("flex-direction", "row")
        .style("align-items", "center") // TODO get rid of this ?
    };

    static ref CENTER_STYLE: String = class! {
        .style("display", "flex")
        .style("flex-direction", "row")
        .style("align-items", "center")
        .style("justify-content", "center")
    };

    static ref STRETCH_STYLE: String = class! {
        .style("flex-shrink", "1")
        .style("flex-grow", "1")
        .style("flex-basis", "0%")
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

    static ref TAB_PINNED_STYLE: String = class! {
        .style("float", "left")
        .style("width", "20px")
        /*.style("background-image", "repeating-linear-gradient(-45deg, \
                                        transparent          0px, \
                                        hsla(0, 0%, 0%, 1) 1px")*/

        /*.style("background-color", "hsl(245, 100%, 98%)")
        // TODO this is needed to override the border color from MENU_ITEM_HOVER_STYLE
        .style_important("border-color", "hsl(245, 77%, 79%) \
                                          hsl(245, 77%, 74%) \
                                          hsl(245, 77%, 69%) \
                                          hsl(245, 77%, 74%)")*/
    };

    static ref TAB_NOT_PINNED_STYLE: String = class! {
        .style("clear", "both")
    };

    static ref TAB_PINNED_HOVER_STYLE: String = class! {
        //.style("background-color", "hsl(245, 77%, 74%)")
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


// TODO test this
fn get_index<A, F>(mut iter: A, real_index: usize, mut f: F) -> usize where A: Iterator, F: FnMut(A::Item) -> bool {
    let mut index = 0;
    let mut len = 0;

    while let Some(x) = iter.next() {
        if f(x) {
            if index == real_index {
                break;

            } else {
                index += 1;
            }
        }

        len += 1;
    }

    len
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

fn none_if<A, F>(signal: A, none_if: f64, mut f: F, min: f64, max: f64) -> impl Signal<Item = Option<String>>
    where A: Signal<Item = Percentage>,
          F: FnMut(Percentage, f64, f64) -> String {
    signal.map(move |t| t.none_if(none_if).map(|t| f(ease(t), min, max)))
}

fn make_url_bar_child<A, D, F>(name: &str, mut display: D, f: F) -> Dom
    where A: IntoStr,
          D: FnMut(Arc<url_bar::UrlBar>) -> bool + 'static,
          F: FnMut(Option<Arc<url_bar::UrlBar>>) -> A + 'static {
    html!("div", {
        .class(&URL_BAR_TEXT_STYLE)
        .class(name)

        .mixin(visible(STATE.url_bar.signal_cloned().map(move |url_bar| {
            if let Some(url_bar) = url_bar {
                display(url_bar)

            } else {
                false
            }
        })))

        .children(&mut [
            text_signal(STATE.url_bar.signal_cloned().map(f))
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

fn tab_template<A: Mixin<DomBuilder<HtmlElement>>>(tab: &Tab, favicon: Dom, text: Dom, close: Dom, mixin: A) -> Dom {
    html!("div", {
        .class(&ROW_STYLE)
        .class(&TAB_STYLE)
        .class(&MENU_ITEM_STYLE)

        .class_signal(&TAB_UNLOADED_STYLE, tab.unloaded.signal())
        .class_signal(&TAB_PINNED_STYLE, tab.pinned.signal())
        .class_signal(&TAB_NOT_PINNED_STYLE, not(tab.pinned.signal()))
        .class_signal(&TAB_FOCUSED_STYLE, tab.is_focused())

        .children(&mut [favicon, text, close])

        .mixin(mixin)
    })
}


fn main() {
    log!("Starting");

    tab_organizer::set_panic_hook(|message| {
        let message = Arc::new(message);
        STATE.failed.set(Some(message.clone()));
        PromiseFuture::print_error_panic(&*message);
    });


    js! { @(no_return)
        setTimeout(@{move || {
            STATE.initialize((0..10).map(|_index| {
                state::Window {
                    serialized: state::SerializedWindow {
                        id: generate_uuid(),
                        name: None,
                        timestamp_created: Date::now(),
                    },
                    focused: false,
                    tabs: (0..10).map(|index| {
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
                }
            }).collect());

            // TODO a little hacky, needed to ensure that scrolling happens after everything is created
            window().request_animation_frame(|_| {
                STATE.is_loaded.set_neq(true);
                log!("Loaded");
            });

            js! { @(no_return)
                setInterval(@{move || {
                    STATE.process_message(Message::TabChanged {
                        window_index: 0,
                        tab_index: 2,
                        change: TabChange::Title {
                            new_title: Some(generate_uuid().to_string()),
                        },
                    });

                    STATE.process_message(Message::TabChanged {
                        window_index: 0,
                        tab_index: 7,
                        change: TabChange::Pinned {
                            pinned: true,
                        },
                    });

                    /*STATE.process_message(Message::TabRemoved {
                        window_index: 0,
                        tab_index: 0,
                    });

                    STATE.process_message(Message::TabRemoved {
                        window_index: 0,
                        tab_index: 8,
                    });

                    STATE.process_message(Message::TabInserted {
                        window_index: 0,
                        tab_index: 0,
                        tab: state::Tab {
                            serialized: state::SerializedTab {
                                id: generate_uuid(),
                                timestamp_created: Date::now()
                            },
                            focused: false,
                            unloaded: true,
                            pinned: false,
                            favicon_url: Some("http://www.saltybet.com/favicon.ico".to_owned()),
                            url: Some("top".to_owned()),
                            title: Some("top".to_owned()),
                        },
                    });

                    STATE.process_message(Message::TabInserted {
                        window_index: 0,
                        tab_index: 8,
                        tab: state::Tab {
                            serialized: state::SerializedTab {
                                id: generate_uuid(),
                                timestamp_created: Date::now()
                            },
                            focused: false,
                            unloaded: false,
                            pinned: true,
                            favicon_url: Some("http://www.saltybet.com/favicon.ico".to_owned()),
                            url: Some("bottom".to_owned()),
                            title: Some("bottom".to_owned()),
                        },
                    });

                    for _ in 0..10 {
                        STATE.process_message(Message::TabRemoved {
                            window_index: 2,
                            tab_index: 0,
                        });
                    }

                    STATE.process_message(Message::WindowRemoved {
                        window_index: 2,
                    });

                    STATE.process_message(Message::WindowInserted {
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
                        STATE.process_message(Message::TabInserted {
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
                }}, @{INSERT_ANIMATION_DURATION + 2000.0});
            }
        }}, 1500);
    }


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

        .style_signal("cursor", STATE.is_dragging().map(|is_dragging| {
            if is_dragging {
                Some("grabbing")

            } else {
                None
            }
        }))
    });

    // Disables the browser scroll restoration
    js! { @(no_return)
        if ("scrollRestoration" in history) {
            history.scrollRestoration = "manual";
        }
    }

    dominator::append_dom(&dominator::body(),
        html!("div", {
            .class(&TOP_STYLE)
            .class(&TEXTURE_STYLE)

            // TODO only attach this when dragging
            .global_event(move |_: MouseUpEvent| {
                STATE.drag_end();
            })

            // TODO only attach this when dragging
            .global_event(move |e: MouseMoveEvent| {
                STATE.drag_move(e.client_x(), e.client_y());
            })

            .global_event(move |_: ResizeEvent| {
                STATE.update(false);
            })

            .future(waiter::waiter(&STATE, move |should_search| {
                STATE.update(should_search);
            }))

            .children(&mut [
                {
                    let show = Mutable::new(false);

                    set_timeout(clone!(show => move || {
                        show.set_neq(true);
                    }), LOADING_MESSAGE_THRESHOLD);

                    html!("div", {
                        .class(&MODAL_STYLE)
                        .class(&LOADING_STYLE)
                        .class(&CENTER_STYLE)

                        .mixin(visible(and(show.signal(), not(STATE.is_loaded.signal()))))

                        .children(&mut [
                            text("LOADING..."),
                        ])
                    })
                },

                html!("div", {
                    .class(&DRAGGING_STYLE)

                    .mixin(visible(STATE.is_dragging()))

                    .style_signal("width", STATE.dragging.state.signal_ref(|dragging| {
                        if let Some(DragState::Dragging { rect, .. }) = dragging {
                            Some(px(rect.get_width()))

                        } else {
                            None
                        }
                    }))

                    .style_signal("transform", STATE.dragging.state.signal_ref(|dragging| {
                        if let Some(DragState::Dragging { mouse_y, rect, .. }) = dragging {
                            Some(format!("translate({}px, {}px)", rect.get_left().round(), (mouse_y - TAB_DRAGGING_TOP)))

                        } else {
                            None
                        }
                    }))

                    .children_signal_vec(STATE.dragging.selected_tabs.signal_ref(|tabs| {
                        tabs.iter().enumerate().map(|(index, tab)| {
                            // TODO use some sort of oneshot animation instead
                            // TODO don't create the animation at all for index 0
                            let animation = MutableAnimation::new(SELECTED_TABS_ANIMATION_DURATION);

                            if index > 0 {
                                animation.animate_to(Percentage::new(1.0));
                            }

                            Dom::with_state(animation, |animation| {
                                tab_template(&tab,
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
                                                //.class_signal(&TAB_PINNED_HOVER_STYLE, tab.pinned.signal())
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
                    }).to_signal_vec())
                }),

                html!("div", {
                    .class(&ROW_STYLE)
                    .class(&URL_BAR_STYLE)

                    .mixin(visible(map_ref! {
                        let is_dragging = STATE.is_dragging(),
                        let url_bar = STATE.url_bar.signal_cloned() => {
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
                        make_url_bar_child(&URL_BAR_PROTOCOL_STYLE, |x| !is_empty(&x.protocol), |url_bar| option_str_default_fn(url_bar, "", |x| &x.protocol)), // .as_ref().map(|x| x.as_str())
                        make_url_bar_child(&URL_BAR_DOMAIN_STYLE, |x| !is_empty(&x.domain), |url_bar| option_str_default_fn(url_bar, "", |x| &x.domain)),
                        make_url_bar_child(&URL_BAR_PATH_STYLE, |x| !is_empty(&x.path), |url_bar| option_str_default_fn(url_bar, "", |x| &x.path)),
                        make_url_bar_child(&URL_BAR_FILE_STYLE, |x| !is_empty(&x.file), |url_bar| option_str_default_fn(url_bar, "", |x| &x.file)),
                        make_url_bar_child(&URL_BAR_QUERY_STYLE, |x| !is_empty(&x.query), |url_bar| option_str_default_fn(url_bar, "", |x| &x.query)),
                        make_url_bar_child(&URL_BAR_HASH_STYLE, |x| !is_empty(&x.hash), |url_bar| option_str_default_fn(url_bar, "", |x| &x.hash)),
                    ])
                }),

                html!("div", {
                    .class(&ROW_STYLE)
                    .class(&TOOLBAR_STYLE)

                    .mixin(visible(STATE.is_loaded.signal()))

                    .children(&mut [
                        html!("input" => InputElement, {
                            .class(&SEARCH_STYLE)
                            .class(&STRETCH_STYLE)

                            .attribute("type", "text")
                            .attribute("autofocus", "")
                            .attribute("autocomplete", "off")
                            .attribute("placeholder", "Search")

                            .attribute_signal("title", STATE.failed.signal_cloned().map(|x| option_str_default(x, "")))

                            .attribute_signal("value", STATE.search_box.signal_cloned().map(|x| DerefFn::new(x, |x| x.as_str())))

                            .with_element(|dom, element: InputElement| {
                                dom.event(move |_: InputEvent| {
                                    let value = Arc::new(element.raw_value());
                                    window().local_storage().insert("tab-organizer.search", &value).unwrap();
                                    STATE.search_parser.set(parse::Parsed::new(&value));
                                    STATE.search_box.set(value);
                                    STATE.update(true);
                                })
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

                                        .event(|_: ClickEvent| {
                                            STATE.menu.show();
                                        })

                                        .children(&mut [
                                            text("Menu"),
                                        ])
                                    }),

                                    STATE.menu.render(|menu| { menu
                                        .submenu("Sort tabs by...", |menu| { menu
                                            .option("Window", STATE.options.sort_tabs.signal_ref(|x| *x == SortTabs::Window), || {
                                                STATE.options.sort_tabs.set_neq(SortTabs::Window);
                                            })

                                            .option("Tag", STATE.options.sort_tabs.signal_ref(|x| *x == SortTabs::Tag), || {
                                                STATE.options.sort_tabs.set_neq(SortTabs::Tag);
                                            })

                                            .separator()

                                            .option("Time (focused)", STATE.options.sort_tabs.signal_ref(|x| *x == SortTabs::TimeFocused), || {
                                                STATE.options.sort_tabs.set_neq(SortTabs::TimeFocused);
                                            })

                                            .option("Time (created)", STATE.options.sort_tabs.signal_ref(|x| *x == SortTabs::TimeCreated), || {
                                                STATE.options.sort_tabs.set_neq(SortTabs::TimeCreated);
                                            })

                                            .separator()

                                            .option("URL", STATE.options.sort_tabs.signal_ref(|x| *x == SortTabs::Url), || {
                                                STATE.options.sort_tabs.set_neq(SortTabs::Url);
                                            })

                                            .option("Name", STATE.options.sort_tabs.signal_ref(|x| *x == SortTabs::Name), || {
                                                STATE.options.sort_tabs.set_neq(SortTabs::Name);
                                            })
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

                    .mixin(visible(STATE.is_loaded.signal()))

                    .with_element(|dom, element: HtmlElement| { dom
                        // TODO also update these when groups/tabs are added/removed ?
                        .event(clone!(element => move |_: ScrollEvent| {
                            if STATE.is_loaded.get() {
                                let local_storage = window().local_storage();
                                let y = element.scroll_top();
                                // TODO is there a more efficient way of converting to a string ?
                                local_storage.insert("tab-organizer.scroll.y", &y.to_string()).unwrap();
                                STATE.scrolling.y.set_neq(y);
                                STATE.update(false);
                            }
                        }))

                        // TODO use set_scroll_top instead
                        .future(map_ref! {
                            let loaded = STATE.is_loaded.signal(),
                            let scroll_y = STATE.scrolling.y.signal() => {
                                if *loaded {
                                    Some(*scroll_y)

                                } else {
                                    None
                                }
                            }
                        // TODO super hacky, figure out a better way to keep the scroll_y in bounds
                        }.for_each(move |scroll_y| {
                            if let Some(scroll_y) = scroll_y {
                                let scroll_y = scroll_y.round();
                                let old_scroll_y = element.scroll_top();

                                if old_scroll_y != scroll_y {
                                    element.set_scroll_top(scroll_y);

                                    // TODO does this cause a reflow ?
                                    let new_scroll_y = element.scroll_top();

                                    if new_scroll_y != scroll_y {
                                        STATE.scrolling.y.set_neq(new_scroll_y);
                                    }

                                    STATE.update(false);
                                }
                            }

                            Ok(())
                        }))
                    })

                    .children(&mut [
                        // TODO this is pretty hacky, but I don't know a better way to make it work
                        html!("div", {
                            .class(&GROUP_LIST_CHILDREN_STYLE)

                            .style_signal("padding-top", STATE.groups_padding.signal().map(px))
                            .style_signal("height", STATE.scrolling.height.signal().map(px))

                            .children_signal_vec(STATE.groups.signal_vec_cloned().enumerate()
                                //.delay_remove(|(_, group)| waiter::delay_animation(&group.insert_animation, &group.visible))
                                .filter_signal_cloned(|(_, group)| group.visible.signal())
                                .map(move |(index, group)| {
                                    if let Some(index) = index.get() {
                                        if STATE.should_be_dragging_group(index) {
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

                                        .event(clone!(group, index => move |_: MouseEnterEvent| {
                                            if let Some(index) = index.get() {
                                                STATE.drag_over_group(group.clone(), index);
                                            }
                                        }))

                                        .children(&mut [
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
                                            }),

                                            html!("div", {
                                                .class(&GROUP_TABS_STYLE)

                                                .style_signal("padding-top", group.tabs_padding.signal().map(px))
                                                .style_signal("padding-bottom", none_if(group.insert_animation.signal(), 1.0, px_range, 0.0, GROUP_PADDING_BOTTOM))

                                                .children_signal_vec(group.tabs.signal_vec_cloned().enumerate()
                                                    //.delay_remove(|(_, tab)| waiter::delay_animation(&tab.insert_animation, &tab.visible))
                                                    .filter_signal_cloned(|(_, tab)| tab.visible.signal())
                                                    .map(move |(index, tab)| {
                                                        if let Some(index) = index.get() {
                                                            if STATE.should_be_dragging_tab(group.id, index) {
                                                                tab.drag_over.jump_to(Percentage::new(1.0));
                                                            }
                                                        }

                                                        tab_template(&tab,
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

                                                                .mixin(visible(tab.is_hovered()))

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
                                                                .class_signal(&TAB_HOVER_STYLE, tab.is_hovered())
                                                                .class_signal(&MENU_ITEM_HOVER_STYLE, tab.is_hovered())
                                                                .class_signal(&TAB_UNLOADED_HOVER_STYLE, and(tab.is_hovered(), tab.unloaded.signal()))
                                                                //.class_signal(&TAB_PINNED_HOVER_STYLE, and(tab.is_hovered(), tab.pinned.signal()))
                                                                .class_signal(&TAB_FOCUSED_HOVER_STYLE, and(tab.is_hovered(), tab.is_focused()))

                                                                .class_signal(&TAB_HOLD_STYLE, tab.is_holding())
                                                                .class_signal(&MENU_ITEM_HOLD_STYLE, tab.is_holding())

                                                                .class_signal(&TAB_SELECTED_STYLE, tab.selected.signal())
                                                                .class_signal(&TAB_SELECTED_HOVER_STYLE, and(tab.is_hovered(), tab.selected.signal()))
                                                                .class_signal(&MENU_ITEM_SHADOW_STYLE, or(tab.is_hovered(), tab.selected.signal()))

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
                                                                    dom.event(clone!(index, group, tab => move |e: MouseDownEvent| {
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
                                                                                STATE.drag_start(e.client_x(), e.client_y(), rect, group.clone(), tab.clone(), index);
                                                                            }
                                                                        }
                                                                    }))
                                                                })

                                                                // TODO only attach this when holding
                                                                .global_event(clone!(tab => move |_: MouseUpEvent| {
                                                                    tab.holding.set_neq(false);
                                                                }))

                                                                .event(clone!(index, group, tab => move |_: MouseEnterEvent| {
                                                                    // TODO should this be inside of the if ?
                                                                    STATE.hover_tab(&tab);

                                                                    if let Some(index) = index.get() {
                                                                        STATE.drag_over(group.clone(), index);
                                                                    }
                                                                }))

                                                                .event(clone!(tab => move |_: MouseLeaveEvent| {
                                                                    // TODO should this check the index, like MouseEnterEvent ?
                                                                    STATE.unhover_tab(&tab);
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
                                                    }))
                                            }),
                                        ])
                                    })
                                }))
                        }),
                    ])
                }),
            ])
        }),
    );

    log!("Finished");
}
