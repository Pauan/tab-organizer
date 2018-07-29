use types::{State, TabState, Group, Tab, Window};
use url_bar::UrlBar;
use tab_organizer::{get_len, get_index, get_sorted_index, str_default};
use tab_organizer::state::{SidebarMessage, TabChange, SortTabs};
use std::ops::Deref;
use std::sync::{Arc, Mutex};
use std::cmp::Ordering;
use uuid::Uuid;
use futures_signals::signal::{Mutable, Signal};
use futures_signals::signal_vec::MutableVec;
use dominator::animation::Percentage;


struct GroupsWindow {
    pinned: Option<Arc<Group>>,
    unpinned: Option<Arc<Group>>,
}

impl GroupsWindow {
    fn new() -> Self {
        Self {
            pinned: None,
            unpinned: None,
        }
    }

    fn get_pinned(&mut self, groups: &MutableVec<Arc<Group>>, should_animate: bool) -> &mut Arc<Group> {
        self.pinned.get_or_insert_with(|| {
            let group = Arc::new(Group::new(true, Mutable::new(Some(Arc::new("Pinned".to_string()))), vec![]));

            if should_animate {
                group.insert_animate();
            }

            groups.lock_mut().insert_cloned(0, group.clone());
            group
        })
    }

    fn get_unpinned(&mut self, groups: &MutableVec<Arc<Group>>, should_animate: bool) -> &mut Arc<Group> {
        self.unpinned.get_or_insert_with(|| {
            let group = Arc::new(Group::new(false, Mutable::new(None), vec![]));

            if should_animate {
                group.insert_animate();
            }

            groups.lock_mut().push_cloned(group.clone());
            group
        })
    }

    fn get_len(&self) -> usize {
        self.pinned.as_ref().map(|pinned| get_len(pinned.tabs.lock_ref().into_iter(), Tab::is_inserted)).unwrap_or(0)
    }

    fn initialize(&mut self, groups: &MutableVec<Arc<Group>>, window: &Window, should_animate: bool) {
        let mut is_pinned = true;

        for tab in window.get_tabs() {
            let group = if tab.pinned.get() {
                assert!(is_pinned);
                self.get_pinned(groups, should_animate)

            } else {
                is_pinned = false;
                self.get_unpinned(groups, should_animate)
            };

            if should_animate {
                tab.insert_animate();
            }

            group.tabs.lock_mut().push_cloned(tab);
        }
    }

    fn tab_inserted(&mut self, groups: &MutableVec<Arc<Group>>, mut tab_index: usize, tab: Arc<Tab>) {
        let len = self.get_len();

        let group = if tab.pinned.get() {
            assert!(tab_index <= len);
            self.get_pinned(groups, true)

        } else {
            assert!(tab_index > len);
            tab_index -= len;
            self.get_unpinned(groups, true)
        };

        group.tabs.lock_mut().insert_cloned(tab_index, tab);
    }

    fn tab_removed(&mut self, _groups: &MutableVec<Arc<Group>>, mut tab_index: usize, _tab: &TabState) {
        let len = self.get_len();

        let field = if tab_index < len {
            &mut self.pinned

        } else {
            tab_index -= len;
            &mut self.unpinned
        };

        let is_removing = {
            let group = field.as_ref().unwrap();
            let tabs = group.tabs.lock_mut();
            let index = get_index(tabs.iter(), tab_index, Tab::is_inserted);
            tabs[index].remove_animate();

            // TODO make this more efficient somehow ?
            if get_len(tabs.iter(), Tab::is_inserted) == 0 {
                group.remove_animate();
                true

            } else {
                false
            }
        };

        if is_removing {
            *field = None;
        }
    }
}


struct GroupsUrl {}

impl GroupsUrl {
    fn new() -> Self {
        Self {}
    }

    // TODO make this faster/more efficient
    fn get_url(url: &str) -> String {
        UrlBar::new(url)
            .map(|url| url.minify())
            .map(|url| format!("{}{}{}{}{}",
                str_default(&url.protocol, ""),
                str_default(&url.separator, ""),
                str_default(&url.authority, ""),
                str_default(&url.domain, ""),
                str_default(&url.port, "")))
            .unwrap_or_else(|| "".to_string())
    }

    fn sort_group(group: &Arc<Group>, url: &str) -> Ordering {
        let name = group.name.lock_ref();
        let name = str_default(&name, "");
        name.cmp(url)
    }

    fn sort_tab(tab: &Arc<Tab>, id: Uuid, url: &str) -> Ordering {
        let x = tab.url.lock_ref();
        let x = str_default(&x, "");
        x.cmp(url).then_with(|| tab.id.cmp(&id))
    }

    fn get_group_index(groups: &[Arc<Group>], url: &str) -> Result<usize, usize> {
        get_sorted_index(groups.into_iter(), |group| {
            if Group::is_inserted(group) {
                Some(Self::sort_group(group, url))

            } else {
                None
            }
        })
    }

    fn get_tab_index(tabs: &[Arc<Tab>], id: Uuid, url: &str) -> Result<usize, usize> {
        get_sorted_index(tabs.into_iter(), |tab| {
            if Tab::is_inserted(tab) {
                Some(Self::sort_tab(tab, id, url))

            } else {
                None
            }
        })
    }

    fn insert_group(groups: &MutableVec<Arc<Group>>, url: String, should_animate: bool) -> Arc<Group> {
        let url = Arc::new(url);

        let mut groups = groups.lock_mut();

        match Self::get_group_index(&groups, &url) {
            Ok(index) => groups[index].clone(),

            Err(index) => {
                let group = Arc::new(Group::new(true, Mutable::new(Some(url)), vec![]));

                if should_animate {
                    group.insert_animate();
                }

                groups.insert_cloned(index, group.clone());

                group
            },
        }
    }

    fn insert_tab(&mut self, groups: &MutableVec<Arc<Group>>, tab: Arc<Tab>, should_animate: bool) {
        let url = tab.url.lock_ref();
        let url = str_default(&url, "");

        let group = Self::insert_group(groups, Self::get_url(&url), should_animate);

        let mut tabs = group.tabs.lock_mut();

        let index = Self::get_tab_index(&tabs, tab.id, url).unwrap_err();

        tabs.insert_cloned(index, tab.clone());
    }

    fn remove_tab(&mut self, groups: &MutableVec<Arc<Group>>, tab: &TabState) {
        let groups = groups.lock_ref();

        let group = {
            let url = tab.url.lock_ref();
            let url = str_default(&url, "");
            let index = Self::get_group_index(&groups, &Self::get_url(&url)).unwrap();
            &groups[index]
        };

        let tabs = group.tabs.lock_ref();

        let id = tab.id;

        let mut is_inserted = false;

        // TODO make this more efficient
        for tab in tabs.iter() {
            if Tab::is_inserted(tab) {
                if tab.id == id {
                    tab.remove_animate();

                } else {
                    is_inserted = true;
                }
            }
        }

        if !is_inserted {
            group.remove_animate();
        }
    }

    fn initialize(&mut self, groups: &MutableVec<Arc<Group>>, window: &Window, should_animate: bool) {
        for tab in window.get_tabs() {
            if should_animate {
                tab.insert_animate();
            }

            self.insert_tab(groups, tab, should_animate);
        }
    }

    fn tab_inserted(&mut self, groups: &MutableVec<Arc<Group>>, _tab_index: usize, tab: Arc<Tab>) {
        self.insert_tab(groups, tab, true);
    }

    fn tab_removed(&mut self, groups: &MutableVec<Arc<Group>>, _tab_index: usize, tab: &TabState) {
        self.remove_tab(groups, tab);
    }
}


enum GroupsState {
    Window(GroupsWindow),
    Tag {},
    TimeFocused {},
    TimeCreated {},
    Url(GroupsUrl),
    Name {},
}

impl GroupsState {
    fn new(sort_tabs: SortTabs) -> Self {
        match sort_tabs {
            SortTabs::Window => GroupsState::Window(GroupsWindow::new()),
            SortTabs::Tag => GroupsState::Tag {},
            SortTabs::TimeFocused => GroupsState::TimeFocused {},
            SortTabs::TimeCreated => GroupsState::TimeCreated {},
            SortTabs::Url => GroupsState::Url(GroupsUrl::new()),
            SortTabs::Name => GroupsState::Name {},
        }
    }

    fn initialize(&mut self, groups: &MutableVec<Arc<Group>>, window: &Window, should_animate: bool) {
        match self {
            GroupsState::Window(x) => x.initialize(groups, window, should_animate),
            GroupsState::Tag {} => {},
            GroupsState::TimeFocused {} => {},
            GroupsState::TimeCreated {} => {},
            GroupsState::Url(x) => x.initialize(groups, window, should_animate),
            GroupsState::Name {} => {},
        }
    }

    fn tab_inserted(&mut self, groups: &MutableVec<Arc<Group>>, tab_index: usize, tab: Arc<Tab>) {
        match self {
            GroupsState::Window(x) => x.tab_inserted(groups, tab_index, tab),
            GroupsState::Tag {} => {},
            GroupsState::TimeFocused {} => {},
            GroupsState::TimeCreated {} => {},
            GroupsState::Url(x) => x.tab_inserted(groups, tab_index, tab),
            GroupsState::Name {} => {},
        }
    }

    fn tab_removed(&mut self, groups: &MutableVec<Arc<Group>>, tab_index: usize, tab: &TabState) {
        match self {
            GroupsState::Window(x) => x.tab_removed(groups, tab_index, tab),
            GroupsState::Tag {} => {},
            GroupsState::TimeFocused {} => {},
            GroupsState::TimeCreated {} => {},
            GroupsState::Url(x) => x.tab_removed(groups, tab_index, tab),
            GroupsState::Name {} => {},
        }
    }
}


pub(crate) struct Groups {
    state: Mutex<GroupsState>,
    groups: MutableVec<Arc<Group>>,
}

impl Groups {
    pub(crate) fn new(sort_tabs: SortTabs, window: &Window) -> Self {
        let this = Self {
            state: Mutex::new(GroupsState::new(sort_tabs)),
            groups: MutableVec::new()
        };

        this.initialize(window);

        this
    }

    fn change_sort(&self, sort_tabs: SortTabs, window: &Window) {
        let mut state = self.state.lock().unwrap();

        for group in self.groups.lock_ref().iter() {
            group.remove_animate();

            let tabs = group.tabs.lock_ref();

            for tab in tabs.iter() {
                if Tab::is_inserted(tab) {
                    tab.remove_animate();
                }
            }
        }

        *state = GroupsState::new(sort_tabs);

        state.initialize(&self.groups, window, true);
    }

    fn initialize(&self, window: &Window) {
        self.state.lock().unwrap().initialize(&self.groups, window, false);
    }

    fn tab_inserted(&self, tab_index: usize, tab: Arc<TabState>) {
        let tab = Arc::new(Tab::new(tab));
        tab.insert_animate();
        self.state.lock().unwrap().tab_inserted(&self.groups, tab_index, tab);
    }

    fn tab_removed(&self, tab_index: usize, tab: &TabState) {
        self.state.lock().unwrap().tab_removed(&self.groups, tab_index, tab);
    }
}

impl Deref for Groups {
    type Target = MutableVec<Arc<Group>>;

    #[inline]
    fn deref(&self) -> &Self::Target {
        &self.groups
    }
}


impl Window {
    // TODO make this more efficient (e.g. returning Iterator)
    pub(crate) fn get_tabs(&self) -> Vec<Arc<Tab>> {
        self.tabs.iter().cloned().map(Tab::new).map(Arc::new).collect()
    }
}


impl Group {
    pub(crate) fn is_inserted(this: &Arc<Self>) -> bool {
        !this.removing.get()
    }

    fn insert_animate(&self) {
        self.insert_animation.jump_to(Percentage::new(0.0));
        self.insert_animation.animate_to(Percentage::new(1.0));
    }

    fn remove_animate(&self) {
        self.removing.set_neq(true);
        self.insert_animation.animate_to(Percentage::new(0.0));
    }
}


impl Tab {
    pub(crate) fn is_inserted(this: &Arc<Self>) -> bool {
        !this.removing.get()
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
}


impl State {
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

    pub(crate) fn is_window_mode(&self) -> impl Signal<Item = bool> {
        self.options.sort_tabs.signal_ref(|x| *x == SortTabs::Window)
    }

    pub(crate) fn change_sort(&self, sort_tabs: SortTabs) {
        let window = self.window.read().unwrap();
        self.groups.change_sort(sort_tabs, &window);
    }
}
