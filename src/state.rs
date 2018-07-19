use uuid::Uuid;


#[derive(Debug, Serialize, Deserialize)]
pub enum TabChange {
    Title {
        new_title: Option<String>,
    },
}

#[derive(Debug, Serialize, Deserialize)]
pub enum Message {
    WindowInserted {
        window_index: usize,
        window: Window,
    },
    WindowRemoved {
        window_index: usize,
    },
    TabInserted {
        window_index: usize,
        tab_index: usize,
        tab: Tab,
    },
    TabRemoved {
        window_index: usize,
        tab_index: usize,
    },
    TabChanged {
        window_index: usize,
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
