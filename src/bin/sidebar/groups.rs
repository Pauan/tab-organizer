use types::{State, TabState, Group, Tab, Window};
use url_bar::UrlBar;
use tab_organizer::{get_len, get_index, get_sorted_index, str_default, round_to_hour, TimeDifference};
use tab_organizer::state::{SidebarMessage, TabChange, SortTabs};
use stdweb::web::Date;
use std::ops::Deref;
use std::sync::{Arc, Mutex};
use std::cmp::Ordering;
use futures_signals::signal::{Mutable, Signal};
use futures_signals::signal_vec::{MutableVec, MutableVecLockRef, MutableVecLockMut};
use dominator::animation::Percentage;


// TODO better name
trait Insertable<A>: Deref<Target = [A]> {
    fn insert(&mut self, index: usize, value: A);
}

impl<A> Insertable<A> for Vec<A> {
    fn insert(&mut self, index: usize, value: A) {
        self.insert(index, value);
    }
}

impl<'a, A> Insertable<A> for MutableVecLockMut<'a, A> where A: Clone {
    fn insert(&mut self, index: usize, value: A) {
        self.insert_cloned(index, value);
    }
}


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

fn get_timestamp_index(groups: &[Arc<Group>], timestamp: f64) -> Result<usize, usize> {
    get_sorted_index(groups.into_iter(), |group| {
        if Group::is_inserted(group) {
            Some(group.timestamp.partial_cmp(&timestamp).unwrap().reverse())

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

fn make_new_group(group_index: GroupIndex, should_animate: bool) -> Arc<Group> {
    let group = match group_index.name {
        None => Arc::new(Group::new(group_index.timestamp, false, Mutable::new(None), vec![])),
        Some(name) => Arc::new(Group::new(group_index.timestamp, true, Mutable::new(Some(name)), vec![])),
    };

    if should_animate {
        group.insert_animate();
    }

    group
}

fn insert_group<A>(groups: &mut A, group_index: GroupIndex, should_animate: bool) -> Arc<Group> where A: Insertable<Arc<Group>> {
    match group_index.index {
        Ok(index) => groups[index].clone(),

        Err(index) => {
            let group = make_new_group(group_index, should_animate);

            groups.insert(index, group.clone());

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

    index.map(|index| get_len(&groups[index].tabs.lock_ref(), Tab::is_inserted)).unwrap_or(0)
}

fn generate_timestamp_title(timestamp: f64, current_time: f64) -> String {
    TimeDifference::new(timestamp, round_to_hour(current_time)).pretty()
}


#[derive(Debug)]
struct GroupIndex {
    index: Result<usize, usize>,
    name: Option<Arc<String>>,
    timestamp: f64,
}

fn sorted_group_indexes(sort: SortTabs, groups: &[Arc<Group>], tab: &TabState) -> Vec<GroupIndex> {
    match sort {
        SortTabs::Window => vec![
            if tab.pinned.get() {
                GroupIndex {
                    index: get_pinned_index(groups),
                    name: Some(Arc::new("Pinned".to_string())),
                    timestamp: 0.0,
                }

            } else {
                GroupIndex {
                    index: get_unpinned_index(groups),
                    name: None,
                    timestamp: 0.0,
                }
            }
        ],

        SortTabs::Tag => {
            let tags = tab.tags.lock_ref();

            tags.iter().map(|tag| {
                GroupIndex {
                    index: get_group_index_name(groups, &tag.name),
                    // TODO make this clone more efficient (e.g. by using Arc for the tags)
                    name: Some(Arc::new(tag.name.clone())),
                    timestamp: 0.0,
                }
            }).collect()
        },

        SortTabs::TimeFocused => vec![],

        SortTabs::TimeCreated => {
            let timestamp_created = round_to_hour(tab.timestamp_created.get());

            vec![
                GroupIndex {
                    index: get_timestamp_index(groups, timestamp_created),
                    // TODO pass in the current time, rather than generating it each time ?
                    name: Some(Arc::new(generate_timestamp_title(timestamp_created, Date::now()))),
                    timestamp: timestamp_created,
                }
            ]
        },

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
                GroupIndex {
                    index: get_group_index_name(groups, &url),
                    name: Some(url),
                    timestamp: 0.0,
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
                GroupIndex {
                    index: get_group_index_name(groups, &title),
                    name: Some(title),
                    timestamp: 0.0,
                }
            ]
        },
    }
}

fn sorted_tab_index(sort: SortTabs, groups: &[Arc<Group>], group: &Group, tabs: &[Arc<Tab>], tab: &TabState, mut tab_index: usize) -> usize {
    match sort {
        SortTabs::Window => {
            if !tab.pinned.get() {
                tab_index -= get_pinned_len(groups);
            }

            get_index(tabs, tab_index, Tab::is_inserted)
        },

        SortTabs::Tag => {
            let name = group.name.lock_ref();
            // TODO this is wrong
            let tag_name = str_default(&name, "");

            // TODO make this more efficient
            let tags = tab.tags.lock_ref();
            // TODO this shouldn't unwrap
            let tag = tags.iter().find(|x| x.name == tag_name).unwrap();

            let id = tab.id;
            let timestamp_added = tag.timestamp_added;

            get_tab_index(tabs, |tab| {
                // TODO make this more efficient
                let tags = tab.tags.lock_ref();
                // TODO this shouldn't unwrap
                let tag = tags.iter().find(|x| x.name == tag_name).unwrap();

                // TODO better float comparison ?
                tag.timestamp_added.partial_cmp(&timestamp_added).unwrap().then_with(|| tab.id.cmp(&id))
            })
        },

        SortTabs::TimeFocused => {
            0
        },

        // TODO sort by the index if the timestamps are the same ?
        SortTabs::TimeCreated => {
            let id = tab.id;

            let timestamp_created = tab.timestamp_created.get();

            get_tab_index(tabs, |tab| {
                tab.timestamp_created.get().partial_cmp(&timestamp_created).unwrap().then_with(|| tab.id.cmp(&id)).reverse()
            })
        },

        SortTabs::Url => {
            let id = tab.id;

            let url = tab.url.lock_ref();
            let url = str_default(&url, "");

            let title = tab.title.lock_ref();
            let title = str_default(&title, "");

            get_tab_index(tabs, |tab| {
                let x = tab.url.lock_ref();
                let x = str_default(&x, "");

                let y = tab.title.lock_ref();
                let y = str_default(&y, "");

                x.cmp(url).then_with(|| y.cmp(title).then_with(|| tab.id.cmp(&id)))
            })
        },

        // TODO use upper-case sorting ?
        SortTabs::Name => {
            let id = tab.id;

            let title = tab.title.lock_ref();
            let title = str_default(&title, "");

            let url = tab.url.lock_ref();
            let url = str_default(&url, "");

            get_tab_index(tabs, |tab| {
                let x = tab.title.lock_ref();
                let x = str_default(&x, "");

                let y = tab.url.lock_ref();
                let y = str_default(&y, "");

                x.cmp(title).then_with(|| y.cmp(url).then_with(|| tab.id.cmp(&id)))
            })
        },
    }
}


fn initialize(sort: SortTabs, window: &Window, should_animate: bool) -> Vec<Arc<Group>> {
    let mut groups = vec![];

    for (tab_index, tab) in window.tabs.iter().cloned().enumerate() {
        tab_inserted(sort, &mut groups, tab, tab_index, should_animate);
    }

    groups
}

fn insert_tab_into_group(sort: SortTabs, groups: &[Arc<Group>], group: &Group, tab: Arc<TabState>, tab_index: usize, should_animate: bool) {
    let mut tabs = group.tabs.lock_mut();

    let index = sorted_tab_index(sort, groups, group, &tabs, &tab, tab_index);

    let tab = Arc::new(Tab::new(tab));

    if should_animate {
        tab.insert_animate();
    }

    tabs.insert_cloned(index, tab);
}

fn tab_inserted<A>(sort: SortTabs, groups: &mut A, tab: Arc<TabState>, tab_index: usize, should_animate: bool) where A: Insertable<Arc<Group>> {
    for group_index in sorted_group_indexes(sort, &groups, &tab) {
        let group = insert_group(groups, group_index, should_animate);
        insert_tab_into_group(sort, &groups, &group, tab.clone(), tab_index, should_animate);
    }
}

fn remove_tab_from_group(group: &Group, tab: &TabState, remove_group: bool) {
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

    if remove_group && !is_inserted {
        group.remove_animate();
    }
}

fn tab_removed(sort: SortTabs, groups: &MutableVecLockRef<Arc<Group>>, tab: &TabState, _tab_index: usize) {
    for group_index in sorted_group_indexes(sort, &groups, tab) {
        let index = group_index.index.unwrap();
        let group = &groups[index];
        remove_tab_from_group(&group, tab, true);
    }
}

fn tab_updated<A>(sort: SortTabs, groups: &mut A, group_indexes: Vec<GroupIndex>, tab: Arc<TabState>, tab_index: usize) where A: Insertable<Arc<Group>> {
    let mut new_groups = sorted_group_indexes(sort, &groups, &tab);

    for group_index in group_indexes {
        let index = group_index.index.unwrap();
        let group = &groups[index];

        // TODO make this more efficient
        let new_index = new_groups.iter().position(|group_index| {
            if let Ok(x) = group_index.index {
                x == index

            } else {
                false
            }
        });

        // Tab exists in the old and new group
        if let Some(index) = new_index {
            new_groups.remove(index);
            remove_tab_from_group(&group, &tab, false);
            insert_tab_into_group(sort, &groups, &group, tab.clone(), tab_index, true);

        // Tab no longer exists in this group
        } else {
            remove_tab_from_group(&group, &tab, true);
        }
    }

    // Tab exists in new groups
    for group_index in new_groups {
        let group = insert_group(groups, group_index, true);
        insert_tab_into_group(sort, &groups, &group, tab.clone(), tab_index, true);
    }
}


#[derive(Debug)]
pub(crate) struct Groups {
    sort: Mutex<SortTabs>,
    groups: MutableVec<Arc<Group>>,
}

impl Groups {
    pub(crate) fn new(sort_tabs: SortTabs, window: &Window) -> Self {
        Self {
            sort: Mutex::new(sort_tabs),
            groups: MutableVec::new_with_values(initialize(sort_tabs, window, false)),
        }
    }

    fn update_group_titles(&self) {
        let should_update = {
            let sort = self.sort.lock().unwrap();

            // TODO replace with `if let`
            match *sort {
                SortTabs::TimeCreated | SortTabs::TimeFocused => true,
                _ => false,
            }
        };

        if should_update {
            let groups = self.groups.lock_ref();

            let current_time = Date::now();

            for group in groups.iter() {
                // TODO only update if the new title is different from the old title
                group.name.set(Some(Arc::new(generate_timestamp_title(group.timestamp, current_time))));
            }
        }
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

        let new_groups = initialize(*sort, window, true);

        // TODO see which of these two looks better
        /*for (index, group) in new_groups.into_iter().enumerate() {
            groups.insert_cloned(index, group);
        }*/

        for group in new_groups {
            groups.push_cloned(group);
        }
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

    fn tab_updated<F>(&self, tab_index: usize, tab: Arc<TabState>, change: F) where F: FnOnce() {
        let sort = self.sort.lock().unwrap();
        let mut groups = self.groups.lock_mut();

        let group_indexes = sorted_group_indexes(*sort, &groups, &tab);

        change();

        tab_updated(*sort, &mut groups, group_indexes, tab, tab_index);
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

                self.groups.tab_updated(tab_index, tab.clone(), || {
                    match change {
                        TabChange::Title { new_title } => {
                            tab.title.set(new_title.map(Arc::new));
                        },
                        TabChange::Pinned { pinned } => {
                            tab.pinned.set_neq(pinned);
                        },
                        TabChange::AddedToTag { tag } => {
                            let mut tags = tab.tags.lock_mut();
                            assert!(tags.iter().all(|x| x.name != tag.name));
                            tags.push(tag);
                        },
                        TabChange::RemovedFromTag { tag_name } => {
                            let mut tags = tab.tags.lock_mut();
                            // TODO use remove_item
                            let index = tags.iter().position(|x| x.name == tag_name).unwrap();
                            tags.remove(index);
                        },
                    }
                });
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

    pub(crate) fn update_group_titles(&self) {
        self.groups.update_group_titles();
    }
}
