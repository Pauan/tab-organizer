use crate::constants::{DRAG_ANIMATION_DURATION, INSERT_ANIMATION_DURATION};
use std::ops::Deref;
use std::sync::{Arc, RwLock};
use std::sync::atomic::{AtomicU32, Ordering};
use tab_organizer::{local_storage_get};
use tab_organizer::state as shared;
use tab_organizer::state::{Options, sidebar, TabStatus};
use crate::url_bar::UrlBar;
use crate::search;
use crate::menu::Menu;
use crate::groups::Groups;
use uuid::Uuid;
use web_sys::DomRect;
use futures_signals::signal::{Signal, Mutable};
use futures_signals::signal_vec::MutableVec;
use dominator::animation::{MutableAnimation, Percentage, OnTimestampDiff};


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
pub(crate) struct Dragging {
    pub(crate) state: Mutable<Option<DragState>>,
    pub(crate) selected_tabs: Mutable<Vec<Arc<Tab>>>,
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


#[derive(Debug)]
pub(crate) struct TabMenuState {
    pub(crate) x: f64,
    pub(crate) y: f64,
    pub(crate) group: Arc<Group>,
    pub(crate) tab: Arc<Tab>,
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
}


#[derive(Debug)]
pub(crate) struct State {
    pub(crate) search_box: Mutable<Arc<String>>,
    pub(crate) search_parser: Mutable<Arc<search::Parsed>>,

    pub(crate) url_bar: Mutable<Option<Arc<UrlBar>>>,
    pub(crate) groups_padding: Mutable<f64>, // TODO use u32 instead ?

    pub(crate) groups: Groups,
    pub(crate) tabs: RwLock<Vec<Arc<TabState>>>,
    pub(crate) options: Options,

    pub(crate) dragging: Dragging,
    pub(crate) scrolling: Scrolling,
    pub(crate) window_size: Mutable<WindowSize>,

    pub(crate) menus: Menus,
    pub(crate) port: Arc<tab_organizer::Port<sidebar::ClientMessage, sidebar::ServerMessage>>,
}

impl State {
    pub(crate) fn new(port: Arc<tab_organizer::Port<sidebar::ClientMessage, sidebar::ServerMessage>>, options: Options, tabs: Vec<shared::Tab>) -> Self {
        let tabs = tabs.into_iter().enumerate().map(|(index, tab)| Arc::new(TabState::new(tab, index))).collect();

        let search_value = local_storage_get("tab-organizer.search").unwrap_or_else(|| "".to_string());
        let scroll_y = local_storage_get("tab-organizer.scroll.y").map(|value| value.parse().unwrap()).unwrap_or(0.0);

        let state = Self {
            search_parser: Mutable::new(Arc::new(search::Parsed::new(&search_value))),
            search_box: Mutable::new(Arc::new(search_value)),

            url_bar: Mutable::new(None),
            groups_padding: Mutable::new(0.0),

            groups: Groups::new(options.sort_tabs.get()),
            tabs: RwLock::new(tabs),
            options,

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
            {
                let tabs = group.tabs.lock_ref();

                for tab in tabs.iter() {
                    tab.selected.set_neq(false);
                }
            }

            group.last_selected_tab.set_neq(None);
        }

        self.port.send_message(&sidebar::ClientMessage::ClickTab {
            uuid: tab.id,
        });
    }

    // TODO unselect the closing tabs ?
    pub(crate) fn close_tabs(&self, tabs: Vec<Arc<Tab>>) {
        let uuids = tabs.into_iter().map(|tab| {
            tab.manually_closed.set_neq(true);
            tab.id
        }).collect();

        self.port.send_message(&sidebar::ClientMessage::CloseTabs { uuids });
    }

    // TODO maybe mutate muted ?
    pub(crate) fn set_muted(&self, uuids: Vec<Uuid>, muted: bool) {
        self.port.send_message(&sidebar::ClientMessage::MuteTabs { uuids, muted });
    }

    pub(crate) fn unload_tabs(&self, uuids: Vec<Uuid>) {
        self.port.send_message(&sidebar::ClientMessage::UnloadTabs { uuids });
    }
}


#[derive(Debug)]
pub(crate) struct TabState {
    pub(crate) id: Uuid,
    pub(crate) favicon_url: Mutable<Option<Arc<String>>>,
    pub(crate) title: Mutable<Option<Arc<String>>>,
    pub(crate) url: Mutable<Option<Arc<String>>>,
    pub(crate) index: Mutable<usize>,
    pub(crate) focused: Mutable<bool>,
    pub(crate) status: Mutable<TabStatus>,
    pub(crate) pinned: Mutable<bool>,
    pub(crate) playing_audio: Mutable<bool>,
    pub(crate) muted: Mutable<bool>,
    pub(crate) has_attention: Mutable<bool>,
    pub(crate) removed: Mutable<bool>,
    pub(crate) manually_closed: Mutable<bool>,
    pub(crate) timestamp_created: Mutable<f64>,
    pub(crate) timestamp_focused: Mutable<Option<f64>>,
    pub(crate) tags: Mutable<Vec<shared::Tag>>,
}

impl TabState {
    pub(crate) fn new(state: shared::Tab, index: usize) -> Self {
        Self {
            id: state.serialized.uuid,
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
            timestamp_created: Mutable::new(state.serialized.timestamp_created),
            timestamp_focused: Mutable::new(state.serialized.timestamp_focused),
            tags: Mutable::new(state.serialized.tags),
        }
    }

    pub(crate) fn timestamp_focused(&self) -> f64 {
        self.timestamp_focused.get().unwrap_or_else(|| self.timestamp_created.get())
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
        self.status.signal_ref(|status| status.is_unloaded())
    }

    pub(crate) fn is_loading(&self) -> impl Signal<Item = bool> {
        self.status.signal_ref(|status| {
            match status {
                TabStatus::New | TabStatus::Loading => true,
                TabStatus::Unloaded | TabStatus::Complete => false,
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

    pub(crate) matches_search: Mutable<bool>,
    pub(crate) last_selected_tab: Mutable<Option<Uuid>>,

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

            matches_search: Mutable::new(false),
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
            self.last_selected_tab.set_neq(Some(tab.id));

        } else {
            self.last_selected_tab.set_neq(None);
        }
    }

    pub(crate) fn shift_select_tab(&self, tab: &Arc<Tab>) {
        let mut last_selected_tab = self.last_selected_tab.lock_mut();

        let selected = if let Some(last_selected_tab) = *last_selected_tab {
            let tabs = self.tabs.lock_ref();
            let mut seen = false;

            for x in tabs.iter() {
                if x.id == last_selected_tab ||
                   x.id == tab.id {
                    x.selected.set_neq(true);

                    if tab.id != last_selected_tab {
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
            *last_selected_tab = Some(tab.id);
        }
    }

    pub(crate) fn select_all_tabs(&self) {
        self.last_selected_tab.set_neq(None);

        let tabs = self.tabs.lock_ref();

        for tab in tabs.iter() {
            tab.selected.set_neq(true);
        }
    }

    pub(crate) fn unselect_all_tabs(&self) {
        self.last_selected_tab.set_neq(None);

        let tabs = self.tabs.lock_ref();

        for tab in tabs.iter() {
            tab.selected.set_neq(false);
        }
    }

    pub(crate) fn selected_tabs(&self) -> Vec<Arc<Tab>> {
        let tabs = self.tabs.lock_ref();

        tabs.iter().filter_map(|tab| {
            if tab.selected.get() {
                Some(tab.clone())

            } else {
                None
            }
        }).collect()
    }
}
