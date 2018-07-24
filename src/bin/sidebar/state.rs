use {DRAG_GAP_PX, TOOLBAR_TOTAL_HEIGHT};
use std::sync::{Arc, RwLock};
use tab_organizer::{and, not};
use tab_organizer::state as server;
use tab_organizer::state::{Options, SidebarMessage, TabChange, SortTabs};
use url_bar;
use parse;
use menu::Menu;
use group::{Tab, Group, Window, TabState};
use groups::Groups;
use stdweb;
use stdweb::web::Rect;
use futures_signals::signal::{Mutable, Signal};
use dominator::animation::{Percentage, OnTimestampDiff};


pub(crate) enum DragState {
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


pub(crate) struct State {
    pub(crate) search_box: Mutable<Arc<String>>,
    pub(crate) search_parser: Mutable<parse::Parsed>,

    pub(crate) url_bar: Mutable<Option<Arc<url_bar::UrlBar>>>,
    pub(crate) groups_padding: Mutable<f64>, // TODO use u32 instead ?

    pub(crate) groups: Groups,
    window: RwLock<Window>,
    pub(crate) options: Options,

    pub(crate) dragging: Dragging,
    pub(crate) scrolling: Scrolling,

    pub(crate) menu: Menu,
}

impl State {
    pub(crate) fn new(options: Options, initial_window: server::Window) -> Self {
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

    pub(crate) fn is_window_mode(&self) -> impl Signal<Item = bool> {
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

    pub(crate) fn is_tab_hovered(&self, tab: &Tab) -> impl Signal<Item = bool> {
        and(tab.hovered.signal(), not(self.is_dragging()))
    }

    pub(crate) fn is_tab_holding(&self, tab: &Tab) -> impl Signal<Item = bool> {
        and(
            and(self.is_tab_hovered(tab), tab.holding.signal()),
            // TODO a little bit hacky
            not(tab.close_hovered.signal())
        )
    }

    pub(crate) fn hover_tab(&self, tab: &Tab) {
        if !tab.hovered.get() {
            tab.hovered.set(true);

            let url = tab.url.lock_ref();

            self.url_bar.set(url.as_ref().and_then(|url| {
                url_bar::UrlBar::new(&url).map(|x| Arc::new(x.minify()))
            }));
        }
    }

    pub(crate) fn unhover_tab(&self, tab: &Tab) {
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
    pub(crate) fn update(&self, should_search: bool) {
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


    pub(crate) fn process_message(&self, message: SidebarMessage) {
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
