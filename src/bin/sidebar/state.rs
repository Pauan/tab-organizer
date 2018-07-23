use {DRAG_GAP_PX, TOOLBAR_TOTAL_HEIGHT, TAB_DRAGGING_THRESHOLD, MOUSE_SCROLL_SPEED, MOUSE_SCROLL_THRESHOLD};
use std::sync::{Arc, RwLock};
use tab_organizer::{and, not, normalize};
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
use dominator::animation::{easing, Percentage, OnTimestampDiff};


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
    on_timestamp_diff: Mutable<Option<OnTimestampDiff>>,
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

    pub(crate) fn should_be_dragging_group(&self, new_index: usize) -> bool {
        let dragging = self.dragging.state.lock_ref();

        if let Some(DragState::Dragging { ref group, .. }) = *dragging {
            let groups = self.groups.lock_ref();

            let old_index = Self::find_group_index(&groups, group.id);

            new_index > old_index

        } else {
            false
        }
    }

    pub(crate) fn should_be_dragging_tab(&self, group_id: usize, new_index: usize) -> bool {
        self.get_dragging_index(group_id).map(|old_index| new_index > old_index).unwrap_or(false)
    }

    pub(crate) fn drag_start(&self, mouse_x: i32, mouse_y: i32, rect: Rect, group: Arc<Group>, tab: Arc<Tab>, tab_index: usize) {
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

    pub(crate) fn drag_move(&self, new_x: i32, new_y: i32) {
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

    pub(crate) fn drag_over(&self, new_group: Arc<Group>, new_index: usize) {
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

    pub(crate) fn drag_over_group(&self, new_group: Arc<Group>, new_group_index: usize) {
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

    pub(crate) fn drag_end(&self) {
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

    pub(crate) fn is_dragging(&self) -> impl Signal<Item = bool> {
        self.dragging.state.signal_ref(|dragging| {
            if let Some(DragState::Dragging { .. }) = dragging {
                true

            } else {
                false
            }
        })
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
