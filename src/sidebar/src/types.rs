use crate::constants::{DRAG_ANIMATION_DURATION, INSERT_ANIMATION_DURATION, SELECTED_TABS_ANIMATION_DURATION};
use std::ops::{Deref, DerefMut};
use std::sync::{Arc, RwLock};
use std::sync::atomic::{AtomicU32, Ordering};
use tab_organizer::{local_storage_get, Port};
use tab_organizer::state as shared;
use tab_organizer::state::{sidebar, TabStatus, TabId};
use crate::url_bar::UrlBar;
use crate::search::Search;
use crate::menu::Menu;
use crate::groups::Groups;
use web_sys::DomRect;
use js_sys::Date;
use futures_signals::signal::{Signal, Mutable, MutableLockRef, MutableLockMut};
use futures_signals::signal_vec::MutableVec;
use futures_signals::signal_map::MutableBTreeMap;
use dominator::animation::{MutableAnimation, Percentage, OnTimestampDiff};


pub(crate) struct OptionsLockMut<'a> {
    port: &'a Port<sidebar::ClientMessage, sidebar::ServerMessage>,
    lock: MutableLockMut<'a, shared::WindowOptions>,
    is_mutated: bool,
}

impl<'a> Deref for OptionsLockMut<'a> {
    type Target = shared::WindowOptions;

    fn deref(&self) -> &Self::Target {
        &*self.lock
    }
}

impl<'a> DerefMut for OptionsLockMut<'a> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        self.is_mutated = true;
        &mut *self.lock
    }
}

impl<'a> Drop for OptionsLockMut<'a> {
    fn drop(&mut self) {
        if self.is_mutated {
            self.port.send_message(&sidebar::ClientMessage::ChangeOptions { options: self.lock.clone() });
        }
    }
}


#[derive(Debug)]
pub(crate) struct Options {
    port: Arc<Port<sidebar::ClientMessage, sidebar::ServerMessage>>,
    inner: Mutable<shared::WindowOptions>,
}

impl Options {
    pub(crate) fn new(port: Arc<Port<sidebar::ClientMessage, sidebar::ServerMessage>>, options: shared::WindowOptions) -> Self {
        Self {
            port,
            inner: Mutable::new(options),
        }
    }

    pub(crate) fn lock_ref(&self) -> MutableLockRef<shared::WindowOptions> {
        self.inner.lock_ref()
    }

    pub(crate) fn lock_mut(&self) -> OptionsLockMut {
        OptionsLockMut {
            port: &self.port,
            lock: self.inner.lock_mut(),
            is_mutated: false,
        }
    }

    pub(crate) fn signal_ref<A, F>(&self, f: F) -> impl Signal<Item = A>
        where F: FnMut(&shared::WindowOptions) -> A {
        self.inner.signal_ref(f)
    }
}


#[derive(Debug)]
pub(crate) enum DragState {
    DragStart {
        mouse_x: i32,
        mouse_y: i32,
        rect: DomRect,
        group: Arc<Group>,
        tab: Arc<Tab>,
        // TODO this shouldn't be based on index, but instead on id
        tab_index: usize,
    },

    // TODO maybe this should be usize rather than Option<usize>
    Dragging {
        mouse_x: i32,
        mouse_y: i32,
        rect: DomRect,
        group: Arc<Group>,
        // TODO should this be based on the id instead ?
        tab_index: Option<usize>,
    },
}


#[derive(Debug)]
pub(crate) struct SelectedTab {
    pub(crate) animation: MutableAnimation,
    pub(crate) tab: Arc<Tab>,
}

impl SelectedTab {
    pub(crate) fn new(tab: Arc<Tab>) -> Self {
        Self {
            animation: MutableAnimation::new(SELECTED_TABS_ANIMATION_DURATION),
            tab,
        }
    }
}


#[derive(Debug)]
pub(crate) struct Dragging {
    pub(crate) state: Mutable<Option<DragState>>,
    pub(crate) selected_tabs: Mutable<Vec<SelectedTab>>,
}

impl Dragging {
    fn new() -> Self {
        Self {
            state: Mutable::new(None),
            selected_tabs: Mutable::new(vec![]),
        }
    }
}


#[derive(Debug)]
pub(crate) struct Scrolling {
    pub(crate) on_timestamp_diff: Mutable<Option<OnTimestampDiff>>,
    pub(crate) y: Mutable<f64>,
    pub(crate) height: Mutable<f64>,
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


#[derive(Debug, Clone, Copy)]
pub(crate) struct WindowSize {
    pub(crate) width: f64,
    pub(crate) height: f64,
}

impl WindowSize {
    pub(crate) fn new() -> Self {
        Self {
            width: tab_organizer::window_width(),
            height: tab_organizer::window_height(),
        }
    }
}


#[derive(Debug, Clone, Copy)]
pub(crate) enum MenuMode {
    Group,
    Tab,
}

#[derive(Debug)]
pub(crate) struct TabMenuState {
    pub(crate) mode: MenuMode,
    pub(crate) x: f64,
    pub(crate) y: f64,
    pub(crate) group: Arc<Group>,
    pub(crate) tab: Arc<Tab>,
    pub(crate) selected: Vec<Arc<Tab>>,
}

impl TabMenuState {
    pub(crate) fn with_tabs<A, F>(&self, f: F) -> A where F: FnOnce(&[Arc<Tab>]) -> A {
        match self.mode {
            MenuMode::Group => f(&self.selected),
            MenuMode::Tab => f(&[self.tab.clone()]),
        }
    }
}


#[derive(Debug)]
pub(crate) struct Menus {
    pub(crate) state: Mutable<Option<TabMenuState>>,
    pub(crate) global: Menu,
    pub(crate) group: Menu,
    pub(crate) tab: Menu,
}

impl Menus {
    fn new() -> Self {
        Self {
            state: Mutable::new(None),
            global: Menu::new(),
            group: Menu::new(),
            tab: Menu::new(),
        }
    }

    pub(crate) fn show(&self, state: TabMenuState) {
        let mode = state.mode;

        self.state.set(Some(state));

        // TODO instead pass in a Mutable<bool> into the Menu
        match mode {
            MenuMode::Group => {
                self.group.show();
            },

            // TODO unselect all tabs in the group ?
            MenuMode::Tab => {
                self.tab.show();
            },
        }
    }
}


#[derive(Debug)]
pub(crate) struct State {
    pub(crate) search: Search,

    pub(crate) url_bar: Mutable<Option<Arc<UrlBar>>>,
    pub(crate) groups_padding: Mutable<f64>, // TODO use u32 instead ?

    pub(crate) groups: Groups,
    pub(crate) tabs: RwLock<Vec<Arc<TabState>>>,
    pub(crate) options: Options,

    pub(crate) dragging: Dragging,
    pub(crate) scrolling: Scrolling,
    pub(crate) window_size: Mutable<WindowSize>,

    pub(crate) all_labels: MutableBTreeMap<String, u32>,

    pub(crate) menus: Menus,
    pub(crate) port: Arc<Port<sidebar::ClientMessage, sidebar::ServerMessage>>,
}

impl State {
    pub(crate) fn new(port: Arc<Port<sidebar::ClientMessage, sidebar::ServerMessage>>, options: Options, tabs: Vec<shared::Tab>) -> Self {
        let tabs = tabs.into_iter().enumerate().map(|(index, tab)| Arc::new(TabState::new(tab, index))).collect();

        let search_value = local_storage_get("tab-organizer.search").unwrap_or_else(|| "".to_string());
        let scroll_y = local_storage_get("tab-organizer.scroll.y").map(|value| value.parse().unwrap()).unwrap_or(0.0);

        let sort_tabs = options.lock_ref().sort_tabs;

        let state = Self {
            search: Search::new(search_value),

            url_bar: Mutable::new(None),
            groups_padding: Mutable::new(0.0),

            groups: Groups::new(sort_tabs),
            tabs: RwLock::new(tabs),
            options,

            all_labels: MutableBTreeMap::new(),

            dragging: Dragging::new(),
            scrolling: Scrolling::new(scroll_y),
            window_size: Mutable::new(WindowSize::new()),

            menus: Menus::new(),
            port,
        };

        state.groups.initialize(&state);

        state
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

    pub(crate) fn click_tab(&self, group: &Group, tab: &Tab) {
        if !tab.selected.get() {
            // TODO maybe this should unselect all tabs, even the ones which don't match the search ?
            group.unselect_all_tabs();
        }

        self.port.send_message(&sidebar::ClientMessage::ClickTab {
            id: tab.id.clone(),
        });
    }

    pub(crate) fn close_duplicate_tabs(&self) {
        self.port.send_message(&sidebar::ClientMessage::CloseDuplicateTabs {});
    }

    // TODO unselect the closing tabs ?
    pub(crate) fn close_tabs(&self, tabs: &[Arc<Tab>]) {
        let ids = tabs.into_iter().map(|tab| {
            tab.manually_closed.set_neq(true);
            tab.id.clone()
        }).collect();

        self.port.send_message(&sidebar::ClientMessage::CloseTabs { ids });
    }

    // TODO maybe mutate muted ?
    pub(crate) fn set_muted(&self, ids: Vec<TabId>, muted: bool) {
        self.port.send_message(&sidebar::ClientMessage::MuteTabs { ids, muted });
    }

    pub(crate) fn unload_tabs(&self, tabs: &[Arc<Tab>]) {
        let ids = tabs.into_iter().map(|tab| {
            tab.selected.set_neq(false);
            tab.id.clone()
        }).collect();

        self.port.send_message(&sidebar::ClientMessage::UnloadTabs { ids });
    }

    pub(crate) fn pin_tabs(&self, tabs: &[Arc<Tab>], pinned: bool) {
        let ids = tabs.into_iter().map(|tab| tab.id.clone()).collect();

        self.port.send_message(&sidebar::ClientMessage::PinTabs { ids, pinned });
    }

    pub(crate) fn add_label(&self, tabs: &[Arc<Tab>], name: String) {
        let label = shared::Label {
            name,
            timestamp_added: Date::now(),
        };

        let ids = tabs.into_iter().map(|tab| tab.id.clone()).collect();

        self.port.send_message(&sidebar::ClientMessage::AddLabelToTabs { ids, label });
    }

    pub(crate) fn remove_label(&self, tabs: &[Arc<Tab>], label_name: String) {
        let ids = tabs.into_iter().map(|tab| tab.id.clone()).collect();

        self.port.send_message(&sidebar::ClientMessage::RemoveLabelFromTabs { ids, label_name });
    }
}


#[derive(Debug)]
pub(crate) struct TabState {
    pub(crate) id: TabId,
    pub(crate) favicon_url: Mutable<Option<Arc<String>>>,
    pub(crate) title: Mutable<Option<Arc<String>>>,
    pub(crate) url: Mutable<Option<Arc<String>>>,
    pub(crate) index: Mutable<usize>,
    pub(crate) focused: Mutable<bool>,
    pub(crate) status: Mutable<Option<TabStatus>>,
    pub(crate) pinned: Mutable<bool>,
    pub(crate) playing_audio: Mutable<bool>,
    pub(crate) muted: Mutable<bool>,
    pub(crate) has_attention: Mutable<bool>,
    pub(crate) removed: Mutable<bool>,
    pub(crate) manually_closed: Mutable<bool>,
    pub(crate) timestamp_created: Mutable<f64>,
    pub(crate) timestamp_focused: Mutable<Option<f64>>,
    pub(crate) labels: Mutable<Vec<shared::Label>>,
}

impl TabState {
    pub(crate) fn new(state: shared::Tab, index: usize) -> Self {
        Self {
            id: state.serialized.id,
            favicon_url: Mutable::new(state.serialized.favicon_url.map(Arc::new)),
            title: Mutable::new(state.serialized.title.map(Arc::new)),
            url: Mutable::new(state.serialized.url.map(Arc::new)),
            index: Mutable::new(index),
            focused: Mutable::new(state.focused),
            status: Mutable::new(state.status),
            pinned: Mutable::new(state.serialized.pinned),
            playing_audio: Mutable::new(state.playing_audio),
            has_attention: Mutable::new(state.has_attention),
            muted: Mutable::new(state.serialized.muted),
            removed: Mutable::new(false),
            manually_closed: Mutable::new(false),
            timestamp_created: Mutable::new(state.serialized.timestamps.created),
            timestamp_focused: Mutable::new(state.serialized.timestamps.focused),
            labels: Mutable::new(state.serialized.labels),
        }
    }

    pub(crate) fn timestamp_focused(&self) -> f64 {
        self.timestamp_focused.get().unwrap_or_else(|| self.timestamp_created.get())
    }

    pub(crate) fn has_label(&self, key: &str) -> bool {
        self.labels.lock_ref().iter().any(|x| x.name == key)
    }
}


#[derive(Debug)]
pub(crate) struct Tab {
    pub(crate) state: Arc<TabState>,

    pub(crate) selected: Mutable<bool>,
    pub(crate) dragging: Mutable<bool>,

    pub(crate) hovered: Mutable<bool>,
    //pub(crate) holding: Mutable<bool>,

    pub(crate) audio_hovered: Mutable<bool>,

    pub(crate) close_hovered: Mutable<bool>,
    pub(crate) close_holding: Mutable<bool>,

    pub(crate) matches_search: Mutable<bool>,
    pub(crate) visible: Mutable<bool>,
    pub(crate) url_bar: Mutable<Option<Arc<UrlBar>>>,

    pub(crate) drag_over: MutableAnimation,
    pub(crate) insert_animation: MutableAnimation,
}

impl Tab {
    pub(crate) fn new(state: Arc<TabState>) -> Self {
        let url_bar = state.url.lock_ref().as_ref().and_then(|url| {
            UrlBar::new(&url).map(|x| Arc::new(x.minify()))
        });

        Self {
            state,

            selected: Mutable::new(false),
            dragging: Mutable::new(false),

            hovered: Mutable::new(false),
            //holding: Mutable::new(false),

            audio_hovered: Mutable::new(false),

            close_hovered: Mutable::new(false),
            close_holding: Mutable::new(false),

            matches_search: Mutable::new(false),
            visible: Mutable::new(false),
            url_bar: Mutable::new(url_bar),

            drag_over: MutableAnimation::new(DRAG_ANIMATION_DURATION),
            insert_animation: MutableAnimation::new_with_initial(INSERT_ANIMATION_DURATION, Percentage::new(0.0)),
        }
    }

    pub(crate) fn is_focused(&self) -> impl Signal<Item = bool> {
        self.focused.signal()
    }

    pub(crate) fn is_unloaded(&self) -> impl Signal<Item = bool> {
        self.status.signal_ref(|status| status.is_none())
    }

    pub(crate) fn is_loading(&self) -> impl Signal<Item = bool> {
        self.status.signal_ref(|status| {
            match status {
                Some(TabStatus::New) | Some(TabStatus::Loading) => true,
                Some(TabStatus::Complete) | Some(TabStatus::Discarded) | None => false,
            }
        })
    }
}

impl Deref for Tab {
    type Target = TabState;

    #[inline]
    fn deref(&self) -> &Self::Target {
        &*self.state
    }
}


#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct GroupId {
    value: u32,
}


#[derive(Debug)]
pub(crate) struct Group {
    pub(crate) id: GroupId,
    pub(crate) show_header: bool,
    pub(crate) pinned: bool,
    pub(crate) timestamp: f64,
    pub(crate) name: Mutable<Option<Arc<String>>>,
    pub(crate) tabs: MutableVec<Arc<Tab>>,

    pub(crate) insert_animation: MutableAnimation,
    pub(crate) visible: Mutable<bool>,

    pub(crate) last_selected_tab: Mutable<Option<TabId>>,

    pub(crate) drag_over: MutableAnimation,
    pub(crate) drag_top: MutableAnimation,
    pub(crate) tabs_padding: Mutable<f64>, // TODO use u32 instead ?
}

impl Group {
    pub(crate) fn new(timestamp: f64, pinned: bool, show_header: bool, name: Mutable<Option<Arc<String>>>, tabs: Vec<Arc<Tab>>) -> Self {
        static ID_COUNTER: AtomicU32 = AtomicU32::new(0);

        Self {
            // TODO investigate whether it's possible to use a faster Ordering
            id: GroupId { value: ID_COUNTER.fetch_add(1, Ordering::SeqCst) },
            pinned,
            show_header,
            timestamp,
            name,
            tabs: MutableVec::new_with_values(tabs),

            insert_animation: MutableAnimation::new_with_initial(INSERT_ANIMATION_DURATION, Percentage::new(0.0)),
            visible: Mutable::new(false),

            last_selected_tab: Mutable::new(None),

            drag_over: MutableAnimation::new(DRAG_ANIMATION_DURATION),
            drag_top: MutableAnimation::new(DRAG_ANIMATION_DURATION),
            tabs_padding: Mutable::new(0.0),
        }
    }

    pub(crate) fn ctrl_select_tab(&self, tab: &Arc<Tab>) {
        let mut selected = tab.selected.lock_mut();

        *selected = !*selected;

        if *selected {
            self.last_selected_tab.set_neq(Some(tab.id.clone()));

        } else {
            self.last_selected_tab.set_neq(None);
        }
    }

    // TODO only include the tabs which match the search
    // TODO maybe only include the visible tabs ?
    pub(crate) fn shift_select_tab(&self, tab: &Arc<Tab>) {
        let mut last_selected_tab = self.last_selected_tab.lock_mut();

        let selected = if let Some(last_selected_tab) = &*last_selected_tab {
            let tabs = self.tabs.lock_ref();
            let mut seen = false;

            for x in tabs.iter() {
                if x.id == *last_selected_tab ||
                   x.id == tab.id {
                    x.selected.set_neq(true);

                    if tab.id != *last_selected_tab {
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
            *last_selected_tab = Some(tab.id.clone());
        }
    }

    // TODO maybe only include the visible tabs ?
    pub(crate) fn visible_tabs_len(&self) -> usize {
        self.tabs.lock_ref()
            .into_iter()
            .filter(|tab| tab.matches_search.get())
            .count()
    }

    // TODO maybe only include the visible tabs ?
    pub(crate) fn select_all_tabs(&self) {
        {
            let tabs = self.tabs.lock_ref();

            for tab in tabs.iter() {
                if tab.matches_search.get() {
                    tab.selected.set_neq(true);
                }
            }
        }

        self.last_selected_tab.set_neq(None);
    }

    // TODO maybe only include the visible tabs ?
    pub(crate) fn unselect_all_tabs(&self) {
        {
            let tabs = self.tabs.lock_ref();

            for tab in tabs.iter() {
                if tab.matches_search.get() {
                    tab.selected.set_neq(false);
                }
            }
        }

        self.last_selected_tab.set_neq(None);
    }

    // TODO maybe only include the visible tabs ?
    pub(crate) fn selected_tabs(&self) -> Vec<Arc<Tab>> {
        let tabs = self.tabs.lock_ref();

        tabs.iter()
            .filter(|tab| tab.selected.get() && tab.matches_search.get())
            .cloned()
            .collect()
    }
}
