use wasm_bindgen::prelude::*;
use wasm_bindgen::intern;
use wasm_bindgen_futures::futures_0_3::JsFuture;
use serde_derive::{Serialize, Deserialize};
use uuid::Uuid;
use futures_signals::signal::Mutable;
use crate::{serialize, deserialize, generate_uuid};
use web_extension::browser;


#[derive(Debug, Serialize, Deserialize)]
pub enum SidebarMessage {
    Initialize {
        id: String,
    },
}


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


#[derive(Debug)]
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
    FaviconUrl {
        new_favicon_url: Option<String>,
    },
    Title {
        new_title: Option<String>,
    },
    Url {
        new_url: Option<String>,
    },
    Pinned {
        pinned: bool,
    },
    AddedToTag {
        tag: Tag,
    },
    RemovedFromTag {
        tag_name: String,
    },
}

#[derive(Debug, Serialize, Deserialize)]
pub enum BackgroundMessage {
    Initial {
        tabs: Vec<Tab>,
    },
    TabInserted {
        tab_index: usize,
        tab: Tab,
    },
    TabRemoved {
        tab_index: usize,
    },
    TabChanged {
        tab_index: usize,
        changes: Vec<TabChange>,
    },
    TabFocused {
        old_tab_index: Option<usize>,
        new_tab_index: usize,
        new_timestamp_focused: f64,
    },
    TabMoved {
        old_tab_index: usize,
        new_tab_index: usize,
    },
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerializedTab {
    pub id: Uuid,
    pub tags: Vec<Tag>,
    pub timestamp_created: f64,
    pub timestamp_focused: Option<f64>,
    pub pinned: bool,
    pub unloaded: bool,
    pub favicon_url: Option<String>,
    pub url: Option<String>,
    pub title: Option<String>,
}

impl SerializedTab {
    pub fn update(&mut self, tab: &web_extension::Tab) -> Vec<TabChange> {
        let mut changes = vec![];

        let favicon_url = tab.fav_icon_url();

        if self.favicon_url != favicon_url {
            self.favicon_url = favicon_url.clone();
            changes.push(TabChange::FaviconUrl { new_favicon_url: favicon_url });
        }

        let url = tab.url();

        if self.url != url {
            self.url = url.clone();
            changes.push(TabChange::Url { new_url: url });
        }

        let title = tab.title();

        if self.title != title {
            self.title = title.clone();
            changes.push(TabChange::Title { new_title: title });
        }

        let pinned = tab.pinned();

        if self.pinned != pinned {
            self.pinned = pinned;
            changes.push(TabChange::Pinned { pinned });
        }

        changes
    }
}


#[derive(Debug, Serialize, Deserialize)]
pub struct SerializedWindow {
    pub id: Uuid,
    pub name: Option<String>,
    pub timestamp_created: f64,
    pub tabs: Vec<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub name: String,
    pub timestamp_added: f64,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tab {
    pub serialized: SerializedTab,
    pub id: i32,
    pub focused: bool,
}

impl Tab {
    pub async fn get_id(tab_id: i32) -> Result<Uuid, JsValue> {
        //JsFuture::from(browser.sessions().remove_tab_value(tab_id, intern("id"))).await?;

        let id = JsFuture::from(browser.sessions().get_tab_value(tab_id, intern("id"))).await?;

        // TODO better implementation of this
        if id == JsValue::undefined() {
            let id = generate_uuid();
            let _ = JsFuture::from(browser.sessions().set_tab_value(tab_id, intern("id"), &serialize(&id))).await?;
            Ok(id)

        } else {
            Ok(deserialize(&id))
        }
    }
}


#[derive(Debug, Serialize, Deserialize)]
pub struct Window {
    pub serialized: SerializedWindow,
    pub id: i32,
    pub focused: bool,
}

impl Window {
    // TODO code duplication
    pub async fn get_id(window_id: i32) -> Result<Uuid, JsValue> {
        //JsFuture::from(browser.sessions().remove_window_value(window_id, intern("id"))).await?;

        let id = JsFuture::from(browser.sessions().get_window_value(window_id, intern("id"))).await?;

        // TODO better implementation of this
        if id == JsValue::undefined() {
            let id = generate_uuid();
            let _ = JsFuture::from(browser.sessions().set_window_value(window_id, intern("id"), &serialize(&id))).await?;
            Ok(id)

        } else {
            Ok(deserialize(&id))
        }
    }
}
