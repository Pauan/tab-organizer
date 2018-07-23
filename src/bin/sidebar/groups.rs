use group::{TabState, Group, Tab, Window};
use tab_organizer::{get_len, get_index};
use tab_organizer::state::SortTabs;
use std::ops::Deref;
use std::sync::{Arc, Mutex};
use futures_signals::signal::Mutable;
use futures_signals::signal_vec::MutableVec;


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

    fn initialize(&mut self, groups: &MutableVec<Arc<Group>>, window: &Window) {
        let mut is_pinned = true;

        for tab in window.get_tabs() {
            let group = if tab.pinned.get() {
                assert!(is_pinned);
                self.get_pinned(groups, false)

            } else {
                is_pinned = false;
                self.get_unpinned(groups, false)
            };

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


enum GroupsState {
    Window(GroupsWindow),
    Tag {},
    TimeFocused {},
    TimeCreated {},
    Url {},
    Name {},
}

impl GroupsState {
    fn new(sort_tabs: SortTabs) -> Self {
        match sort_tabs {
            SortTabs::Window => GroupsState::Window(GroupsWindow::new()),
            SortTabs::Tag => GroupsState::Tag {},
            SortTabs::TimeFocused => GroupsState::TimeFocused {},
            SortTabs::TimeCreated => GroupsState::TimeCreated {},
            SortTabs::Url => GroupsState::Url {},
            SortTabs::Name => GroupsState::Name {},
        }
    }

    fn initialize(&mut self, groups: &MutableVec<Arc<Group>>, window: &Window) {
        match self {
            GroupsState::Window(x) => x.initialize(groups, window),
            GroupsState::Tag {} => {},
            GroupsState::TimeFocused {} => {},
            GroupsState::TimeCreated {} => {},
            GroupsState::Url {} => {},
            GroupsState::Name {} => {},
        }
    }

    fn tab_inserted(&mut self, groups: &MutableVec<Arc<Group>>, tab_index: usize, tab: Arc<Tab>) {
        match self {
            GroupsState::Window(x) => x.tab_inserted(groups, tab_index, tab),
            GroupsState::Tag {} => {},
            GroupsState::TimeFocused {} => {},
            GroupsState::TimeCreated {} => {},
            GroupsState::Url {} => {},
            GroupsState::Name {} => {},
        }
    }

    fn tab_removed(&mut self, groups: &MutableVec<Arc<Group>>, tab_index: usize, tab: &TabState) {
        match self {
            GroupsState::Window(x) => x.tab_removed(groups, tab_index, tab),
            GroupsState::Tag {} => {},
            GroupsState::TimeFocused {} => {},
            GroupsState::TimeCreated {} => {},
            GroupsState::Url {} => {},
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

    pub(crate) fn initialize(&self, window: &Window) {
        self.state.lock().unwrap().initialize(&self.groups, window);
    }

    pub(crate) fn tab_inserted(&self, tab_index: usize, tab: Arc<TabState>) {
        let tab = Arc::new(Tab::new(tab));
        tab.insert_animate();
        self.state.lock().unwrap().tab_inserted(&self.groups, tab_index, tab);
    }

    pub(crate) fn tab_removed(&self, tab_index: usize, tab: &TabState) {
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
