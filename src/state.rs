use uuid::Uuid;
use futures_signals::signal::Mutable;


// TODO this is a common option
#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub enum SortTabs {
    Window,
    Tag,
    TimeFocused,
    TimeCreated,
    Url,
    Name,
}


pub struct Options {
    pub sort_tabs: Mutable<SortTabs>,
}

impl Options {
    pub fn new() -> Self {
        Self {
            sort_tabs: Mutable::new(SortTabs::Window),
        }
    }

    pub fn merge(&self, other: &Self) {
        self.sort_tabs.set_neq(other.sort_tabs.get());
    }
}


#[derive(Debug, Serialize, Deserialize)]
pub enum TabChange {
    Title {
        new_title: Option<String>,
    },
    Pinned {
        pinned: bool,
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub enum SidebarMessage {
    TabInserted {
        tab_index: usize,
        tab: Tab,
    },
    TabRemoved {
        tab_index: usize,
    },
    TabChanged {
        tab_index: usize,
        change: TabChange,
    },
}


#[derive(Debug, Serialize, Deserialize)]
pub struct SerializedTab {
    pub id: Uuid,
    pub timestamp_created: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SerializedWindow {
    pub id: Uuid,
    pub name: Option<String>,
    pub timestamp_created: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Tab {
    pub serialized: SerializedTab,
    pub focused: bool,
    pub unloaded: bool,
    pub pinned: bool,
    pub favicon_url: Option<String>,
    pub url: Option<String>,
    pub title: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Window {
    pub serialized: SerializedWindow,
    pub focused: bool,
    pub tabs: Vec<Tab>,
}
