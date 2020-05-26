use serde_derive::{Serialize, Deserialize};
use uuid::Uuid;
use lazy_static::lazy_static;
use std::collections::HashMap;
use crate::browser;


pub mod sidebar {
    use super::{Label, Tab, TabStatus, WindowOptions};
    use serde_derive::{Serialize, Deserialize};
    use uuid::Uuid;


    #[derive(Debug, Serialize, Deserialize)]
    #[serde(tag = "type")]
    pub enum ClientMessage {
        Initialize {
            id: String,
        },
        ChangeOptions {
            options: WindowOptions,
        },
        ClickTab {
            uuid: Uuid,
        },
        CloseTabs {
            uuids: Vec<Uuid>,
        },
        UnloadTabs {
            uuids: Vec<Uuid>,
        },
        MuteTabs {
            uuids: Vec<Uuid>,
            muted: bool,
        },
        MoveTabs {
            uuids: Vec<Uuid>,
            index: usize,
        },
        PinTabs {
            uuids: Vec<Uuid>,
            pinned: bool,
        },
        AddLabelToTabs {
            uuids: Vec<Uuid>,
            label: Label,
        },
        RemoveLabelFromTabs {
            uuids: Vec<Uuid>,
            label_name: String,
        },
    }

    #[derive(Debug, Serialize, Deserialize)]
    #[serde(tag = "type")]
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
        AddedToLabel {
            label: Label,
        },
        RemovedFromLabel {
            label_name: String,
        },
        Muted {
            muted: bool,
        },
        PlayingAudio {
            playing: bool,
        },
        HasAttention {
            has: bool,
        },
        Status {
            status: TabStatus,
        },
        Unfocused,
        Focused {
            new_timestamp_focused: f64,
        },
    }

    #[derive(Debug, Serialize, Deserialize)]
    #[serde(tag = "type")]
    pub enum ServerMessage {
        Initial {
            tabs: Vec<Tab>,
            options: WindowOptions,
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
        TabMoved {
            old_tab_index: usize,
            new_tab_index: usize,
        },
    }
}


pub mod options {
    use serde_derive::{Serialize, Deserialize};
    use super::SerializedTab;


    #[derive(Debug, Serialize, Deserialize)]
    #[serde(tag = "type")]
    pub enum ClientMessage {
        Initialize,
        Import {
            data: String,
        },
        Export,
    }

    #[derive(Debug, Serialize, Deserialize)]
    #[serde(tag = "type")]
    pub enum ServerMessage {
        Initial,
        ExportFinished,
        Imported {
            tabs: Vec<SerializedTab>,
        },
    }
}


// TODO this is a common option
#[derive(Debug, Copy, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum SortTabs {
    Label,
    Index,
    TimeFocused,
    TimeCreated,
    Url,
    Name,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowOptions {
    pub sort_tabs: SortTabs,
}

impl WindowOptions {
    pub fn new() -> Self {
        Self {
            sort_tabs: SortTabs::Label,
        }
    }
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Label {
    pub name: String,
    pub timestamp_added: f64,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerializedTab {
    pub uuid: Uuid,
    pub labels: Vec<Label>,
    pub timestamp_created: f64,
    pub timestamp_focused: Option<f64>,
    pub pinned: bool,
    pub favicon_url: Option<String>,
    pub url: Option<String>,
    pub title: Option<String>,
    pub muted: bool,
}

impl SerializedTab {
    pub fn new(uuid: Uuid, timestamp_created: f64) -> Self {
        Self {
            uuid,
            labels: vec![],
            timestamp_created,
            timestamp_focused: None,
            pinned: false,
            favicon_url: None,
            url: None,
            title: None,
            muted: false,
        }
    }

    pub fn has_label(&self, label: &str) -> bool {
        self.labels.iter().any(|x| x.name == label)
    }

    pub fn add_label(&mut self, label: Label) {
        // TODO insert sorted ?
        self.labels.push(label);
    }

    pub fn remove_label(&mut self, name: &str) -> bool {
        let mut removed = false;

        self.labels.retain(|label| {
            if label.name == name {
                removed = true;
                false

            } else {
                true
            }
        });

        removed
    }

    pub fn key(uuid: Uuid) -> String {
        format!("tab-ids.{}", uuid)
    }

    pub fn has_good_url(&self) -> bool {
        self.url.as_deref().map(|url| {
            // Based on the restrictions here: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/create
            !(
                url.starts_with("chrome:") ||
                url.starts_with("javascript:") ||
                url.starts_with("data:") ||
                url.starts_with("file:") ||
                (url.starts_with("about:") && url != "about:blank")
            )
        }).unwrap_or(true)
    }

    // TODO hack needed because Firefox doesn't provide favicon URLs for some built-in pages
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1462948
    fn get_favicon(favicon: Option<&str>) -> Option<String> {
        lazy_static! {
            static ref FAVICONS: HashMap<&'static str, &'static str> = vec![
                ("chrome://mozapps/skin/extensions/extension.svg", "favicons/extension.svg"),
                ("chrome://devtools/skin/images/profiler-stopwatch.svg", "favicons/profiler-stopwatch.svg"),
            ].into_iter().collect();
        }

        let favicon = favicon?;

        let favicon = match FAVICONS.get(favicon) {
            Some(favicon) => favicon,
            None => favicon,
        };

        Some(favicon.to_owned())
    }

    pub fn update(&mut self, tab: &browser::TabState) -> Vec<sidebar::TabChange> {
        let mut changes = vec![];

        let favicon_url = Self::get_favicon(tab.favicon_url.as_deref());

        if self.favicon_url != favicon_url {
            // TOOD update the favicon URL when the tab's status changes
            // This is needed to fix the favicon for about:blank
            if self.url != tab.url || favicon_url.is_some() {
                self.favicon_url = favicon_url;
                changes.push(sidebar::TabChange::FaviconUrl { new_favicon_url: self.favicon_url.clone() });
            }
        }

        if self.url != tab.url {
            self.url = tab.url.clone();
            changes.push(sidebar::TabChange::Url { new_url: self.url.clone() });
        }

        if self.title != tab.title {
            self.title = tab.title.clone();
            changes.push(sidebar::TabChange::Title { new_title: self.title.clone() });
        }

        if self.pinned != tab.pinned {
            self.pinned = tab.pinned;
            changes.push(sidebar::TabChange::Pinned { pinned: self.pinned });
        }

        if self.muted != tab.audio.muted {
            self.muted = tab.audio.muted;
            changes.push(sidebar::TabChange::Muted { muted: self.muted });
        }

        changes
    }

    pub fn initialize(&mut self, tab: &browser::TabState, timestamp_focused: f64) -> bool {
        let mut changed = false;

        if tab.focused && self.timestamp_focused.is_none() {
            self.timestamp_focused = Some(timestamp_focused);
            changed = true;
        }

        changed
    }
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerializedWindow {
    pub uuid: Uuid,
    pub name: Option<String>,
    pub timestamp_created: f64,
    pub tabs: Vec<Uuid>,
    pub options: WindowOptions,
}

impl SerializedWindow {
    pub fn new(uuid: Uuid, timestamp_created: f64) -> Self {
        Self {
            uuid,
            name: None,
            timestamp_created,
            tabs: vec![],
            options: WindowOptions::new(),
        }
    }

    pub fn key(uuid: Uuid) -> String {
        format!("window-ids.{}", uuid)
    }

    pub fn tab_index(&self, tab_uuid: Uuid) -> Option<usize> {
        self.tabs.iter().position(|x| *x == tab_uuid)
    }
}


#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Hash)]
pub enum TabStatus {
    Unloaded, // TODO is this a good idea ?
    New,
    Loading,
    Complete,
}

impl TabStatus {
    #[inline]
    pub fn is_unloaded(&self) -> bool {
        match self {
            Self::Unloaded => true,
            _ => false,
        }
    }
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tab {
    pub serialized: SerializedTab,
    pub focused: bool,
    pub playing_audio: bool,
    pub has_attention: bool,
    pub status: TabStatus,
}

impl Tab {
    pub fn unloaded(serialized: SerializedTab) -> Self {
        Self {
            serialized,
            focused: false,
            playing_audio: false,
            has_attention: false,
            status: TabStatus::Unloaded,
        }
    }
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Window {
    pub serialized: SerializedWindow,
    pub focused: bool,
}
