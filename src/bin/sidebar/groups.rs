use types::{State, TabState, Group, Tab, Window};
use url_bar::UrlBar;
use tab_organizer::{get_len, get_index, get_sorted_index, str_default};
use tab_organizer::state::{SidebarMessage, TabChange, SortTabs};
use std::ops::Deref;
use std::sync::{Arc, Mutex};
use std::cmp::Ordering;
use futures_signals::signal::{Mutable, Signal};
use futures_signals::signal_vec::{MutableVec, MutableVecLockRef, MutableVecLockMut};
use dominator::animation::Percentage;


fn get_group_index_name(groups: &[Arc<Group>], name: &str) -> Result<usize, usize> {
    get_group_index(groups, |x| x.cmp(name))
}

fn get_group_index<F>(groups: &[Arc<Group>], mut f: F) -> Result<usize, usize> where F: FnMut(&str) -> Ordering {
    get_sorted_index(groups.into_iter(), |group| {
        if Group::is_inserted(group) {
            let name = group.name.lock_ref();
            let name = str_default(&name, "");
            Some(f(name))

        } else {
            None
        }
    })
}

fn get_tab_index<F>(tabs: &[Arc<Tab>], mut f: F) -> usize where F: FnMut(&Tab) -> Ordering {
    get_sorted_index(tabs.into_iter(), |tab| {
        if Tab::is_inserted(tab) {
            Some(f(tab))

        } else {
            None
        }
    }).unwrap_err()
}

fn insert_group(groups: &mut MutableVecLockMut<Arc<Group>>, group_sort: GroupSort, should_animate: bool) -> Arc<Group> {
    match group_sort.index {
        Ok(index) => groups[index].clone(),

        Err(index) => {
            let group = match group_sort.name {
                None => Arc::new(Group::new(false, Mutable::new(None), vec![])),
                Some(name) => Arc::new(Group::new(true, Mutable::new(Some(name)), vec![])),
            };

            if should_animate {
                group.insert_animate();
            }

            groups.insert_cloned(index, group.clone());

            group
        },
    }
}

fn get_pinned_index(groups: &[Arc<Group>]) -> Result<usize, usize> {
    get_group_index(groups, |name| {
        if name == "Pinned" {
            Ordering::Equal

        } else {
            Ordering::Greater
        }
    })
}

fn get_unpinned_index(groups: &[Arc<Group>]) -> Result<usize, usize> {
    get_group_index(groups, |name| {
        if name == "Pinned" {
            Ordering::Less

        } else {
            Ordering::Equal
        }
    })
}

fn get_pinned_len(groups: &[Arc<Group>]) -> usize {
    let index = get_pinned_index(groups);

    index.map(|index| get_len(groups[index].tabs.lock_ref().into_iter(), Tab::is_inserted)).unwrap_or(0)
}


struct GroupSort {
    index: Result<usize, usize>,
    name: Option<Arc<String>>,
}

fn get_group_sort(sort: SortTabs, groups: &[Arc<Group>], tab: &TabState) -> Vec<GroupSort> {
    match sort {
        SortTabs::Window => vec![
            if tab.pinned.get() {
                GroupSort {
                    index: get_pinned_index(groups),
                    name: Some(Arc::new("Pinned".to_string())),
                }

            } else {
                GroupSort {
                    index: get_unpinned_index(groups),
                    name: None,
                }
            }
        ],

        SortTabs::Tag => vec![],

        SortTabs::TimeFocused => vec![],

        SortTabs::TimeCreated => vec![],

        SortTabs::Url => {
            let url = tab.url.lock_ref();
            let url = str_default(&url, "");

            // TODO make this faster/more efficient
            let url =  UrlBar::new(url)
                .map(|url| url.minify())
                .map(|url| format!("{}{}{}{}{}",
                    str_default(&url.protocol, ""),
                    str_default(&url.separator, ""),
                    str_default(&url.authority, ""),
                    str_default(&url.domain, ""),
                    str_default(&url.port, "")))
                .unwrap_or_else(|| "".to_string());

            let url = Arc::new(url);

            vec![
                GroupSort {
                    index: get_group_index_name(groups, &url),
                    name: Some(url),
                }
            ]
        },

        SortTabs::Name => {
            let title = tab.title.lock_ref();
            let title = str_default(&title, "");
            let title = title.trim(); // TODO is it too expensive to use Unicode trim ?

            let title = title.chars().nth(0);

            let title = if let Some(char) = title {
                // TODO is it too expensive to use Unicode uppercase ?
                char.to_ascii_uppercase().to_string()

            } else {
                "".to_string()
            };

            let title = Arc::new(title);

            vec![
                GroupSort {
                    index: get_group_index_name(groups, &title),
                    name: Some(title),
                }
            ]
        },
    }
}

fn get_tab_sort(sort: SortTabs, groups: &[Arc<Group>], tabs: &[Arc<Tab>], tab: &TabState, mut tab_index: usize) -> usize {
    match sort {
        SortTabs::Window => {
            if !tab.pinned.get() {
                tab_index -= get_pinned_len(groups);
            }

            get_index(tabs.into_iter(), tab_index, Tab::is_inserted)
        },

        SortTabs::Tag => {
            Err(0)
        },

        SortTabs::TimeFocused => {
            Err(0)
        },

        SortTabs::TimeCreated => {
            Err(0)
        },

        SortTabs::Url => {
            let id = tab.id;
            let url = tab.url.lock_ref();
            let url = str_default(&url, "");

            get_tab_index(tabs, |tab| {
                let x = tab.url.lock_ref();
                let x = str_default(&x, "");
                x.cmp(url).then_with(|| tab.id.cmp(&id))
            })
        },

        // TODO use upper-case sorting ?
        SortTabs::Name => {
            let id = tab.id;
            let title = tab.title.lock_ref();
            let title = str_default(&title, "");

            get_tab_index(tabs, |tab| {
                let x = tab.title.lock_ref();
                let x = str_default(&x, "");
                x.cmp(title).then_with(|| tab.id.cmp(&id))
            })
        },
    }
}


fn initialize(sort: SortTabs, groups: &mut MutableVecLockMut<Arc<Group>>, window: &Window, should_animate: bool) {
    for (index, tab) in window.tabs.iter().cloned().enumerate() {
        tab_inserted(sort, groups, tab, index, should_animate);
    }
}

fn tab_inserted(sort: SortTabs, groups: &mut MutableVecLockMut<Arc<Group>>, tab: Arc<TabState>, tab_index: usize, should_animate: bool) {
    for group_sort in get_group_sort(sort, &groups, &tab) {
        let group = insert_group(groups, group_sort, should_animate);

        let mut tabs = group.tabs.lock_mut();

        let index = get_tab_sort(sort, &groups, &tabs, &tab, tab_index);

        let tab = Arc::new(Tab::new(tab.clone()));

        if should_animate {
            tab.insert_animate();
        }

        tabs.insert_cloned(index, tab);
    }
}

fn tab_removed(sort: SortTabs, groups: &MutableVecLockRef<Arc<Group>>, tab: &TabState, _tab_index: usize) {
    for group_sort in get_group_sort(sort, &groups, tab) {
        let index = group_sort.index.unwrap();
        let group = &groups[index];

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
}


#[derive(Debug)]
pub(crate) struct Groups {
    sort: Mutex<SortTabs>,
    groups: MutableVec<Arc<Group>>,
}

impl Groups {
    pub(crate) fn new(sort_tabs: SortTabs, window: &Window) -> Self {
        let this = Self {
            sort: Mutex::new(sort_tabs),
            groups: MutableVec::new()
        };

        this.initialize(window);

        this
    }

    fn change_sort(&self, sort_tabs: SortTabs, window: &Window) {
        let mut sort = self.sort.lock().unwrap();

        let mut groups = self.groups.lock_mut();

        for group in groups.iter() {
            group.remove_animate();

            let tabs = group.tabs.lock_ref();

            for tab in tabs.iter() {
                if Tab::is_inserted(tab) {
                    tab.remove_animate();
                }
            }
        }

        *sort = sort_tabs;

        initialize(*sort, &mut groups, window, true);
    }

    fn initialize(&self, window: &Window) {
        let sort = self.sort.lock().unwrap();
        let mut groups = self.groups.lock_mut();
        initialize(*sort, &mut groups, window, false);
    }

    fn tab_inserted(&self, tab_index: usize, tab: Arc<TabState>) {
        let sort = self.sort.lock().unwrap();
        let mut groups = self.groups.lock_mut();
        tab_inserted(*sort, &mut groups, tab, tab_index, true);
    }

    fn tab_removed(&self, tab_index: usize, tab: &TabState) {
        let sort = self.sort.lock().unwrap();
        let groups = self.groups.lock_ref();
        tab_removed(*sort, &groups, tab, tab_index);
    }
}

impl Deref for Groups {
    type Target = MutableVec<Arc<Group>>;

    #[inline]
    fn deref(&self) -> &Self::Target {
        &self.groups
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
