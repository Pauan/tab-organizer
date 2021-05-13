use serde_derive::{Serialize, Deserialize};
use uuid::Uuid;
use lazy_static::lazy_static;
use std::collections::HashMap;
use crate::browser;


// TODO verify that this behaves correctly when importing windows/tabs
pub fn merge_ids<A>(ids: &mut Vec<A>, new_ids: &[A]) -> bool where A: PartialEq + Clone {
    let mut touched = false;

    let mut indices = Vec::with_capacity(new_ids.len());

    for new_id in new_ids {
        match ids.iter().position(|old_id| *old_id == *new_id) {
            // Tab exists
            Some(index) => {
                match indices.iter().position(|old_index| *old_index > index) {
                    // Out of order
                    Some(swap_start) => {
                        let _ = indices[swap_start..].into_iter().fold(index, |old, &new| {
                            ids.swap(old, new);
                            new
                        });

                        indices.insert(swap_start, index);
                        touched = true;
                    },
                    None => {
                        indices.push(index);
                    },
                }
            },

            // Tab doesn't exist
            None => {
                let index = match indices.last() {
                    Some(index) => index + 1,
                    None => 0,
                };

                indices.push(index);
                ids.insert(index, new_id.clone());

                touched = true;
            },
        }
    }

    touched
}


pub mod sidebar {
    use super::{Label, Tab, TabStatus, TabId, WindowOptions};
    use serde_derive::{Serialize, Deserialize};


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
            id: TabId,
        },
        CloseTabs {
            ids: Vec<TabId>,
        },
        UnloadTabs {
            ids: Vec<TabId>,
        },
        MuteTabs {
            ids: Vec<TabId>,
            muted: bool,
        },
        MoveTabs {
            ids: Vec<TabId>,
            index: usize,
        },
        PinTabs {
            ids: Vec<TabId>,
            pinned: bool,
        },
        AddLabelToTabs {
            ids: Vec<TabId>,
            label: Label,
        },
        RemoveLabelFromTabs {
            ids: Vec<TabId>,
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
            status: Option<TabStatus>,
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
        Imported,
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

    pub fn merge(&mut self, other: Self) -> bool {
        let mut changed = false;

        if self.sort_tabs != other.sort_tabs {
            // TODO update based on the timestamp_updated
            self.sort_tabs = other.sort_tabs;
            changed = true;
        }

        changed
    }
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Label {
    pub name: String,
    pub timestamp_added: f64,
}

impl Label {
    fn merge(&mut self, other: Self) -> bool {
        let mut changed = false;

        if other.timestamp_added < self.timestamp_added {
            self.timestamp_added = other.timestamp_added;
            changed = true;
        }

        changed
    }
}


#[repr(transparent)]
#[serde(transparent)]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct TabId(String);

impl TabId {
    pub fn from_uuid(uuid: Uuid) -> Self {
        Self(uuid.to_string())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl From<Uuid> for TabId {
    fn from(other: Uuid) -> Self {
        TabId::from_uuid(other)
    }
}


#[repr(transparent)]
#[serde(transparent)]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct WindowId(String);

impl WindowId {
    pub fn from_uuid(uuid: Uuid) -> Self {
        Self(uuid.to_string())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl From<Uuid> for WindowId {
    fn from(other: Uuid) -> Self {
        WindowId::from_uuid(other)
    }
}


fn merge_options(old: &mut Option<f64>, new: Option<f64>) -> bool {
    match new {
        Some(new) => {
            let is_newer = match old {
                Some(old) => new > *old,
                None => true,
            };

            if is_newer {
                *old = Some(new);
                true

            } else {
                false
            }
        },
        None => false,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Timestamps {
    pub created: f64,
    pub updated: Option<f64>,
    pub focused: Option<f64>,
    pub unloaded: Option<f64>,
}

impl Timestamps {
    fn merge(&mut self, other: Self) -> bool {
        let mut changed = false;

        if other.created < self.created {
            self.created = other.created;
            changed = true;
        }

        if merge_options(&mut self.updated, other.updated) {
            changed = true;
        }

        if merge_options(&mut self.focused, other.focused) {
            changed = true;
        }

        // TODO should this use the min or max ?
        if merge_options(&mut self.unloaded, other.unloaded) {
            changed = true;
        }

        changed
    }

    pub fn focused(&self) -> f64 {
        self.focused.unwrap_or_else(|| self.created)
    }

    pub fn updated(&self) -> f64 {
        self.updated.unwrap_or_else(|| self.created)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerializedTab {
    pub id: TabId,
    pub labels: Vec<Label>,
    pub timestamps: Timestamps,
    pub pinned: bool,
    pub favicon_url: Option<String>,
    pub url: Option<String>,
    pub title: Option<String>,
    pub muted: bool,
}

impl SerializedTab {
    pub fn new(id: TabId, timestamp_created: f64) -> Self {
        Self {
            id,
            labels: vec![],
            timestamps: Timestamps {
                created: timestamp_created,
                updated: None,
                focused: None,
                unloaded: None,
            },
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

    pub fn key(id: &TabId) -> String {
        format!("tab-ids.{}", id.as_str())
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

        if tab.focused && self.timestamps.focused.is_none() {
            self.timestamps.focused = Some(timestamp_focused);
            changed = true;
        }

        changed
    }

    pub fn merge(&mut self, other: Self) -> bool {
        assert_eq!(self.id, other.id);

        let mut changed = false;

        let is_newer = other.timestamps.updated() > self.timestamps.updated();

        for other in other.labels.into_iter() {
            match self.labels.iter_mut().find(|label| label.name == other.name) {
                Some(label) => {
                    if label.merge(other) {
                        changed = true;
                    }
                },
                None => {
                    self.labels.push(other);
                    changed = true;
                },
            }
        }

        if self.timestamps.merge(other.timestamps) {
            changed = true;
        }

        if is_newer {
            if self.pinned != other.pinned {
                self.pinned = other.pinned;
                changed = true;
            }

            if self.favicon_url != other.favicon_url {
                self.favicon_url = other.favicon_url;
                changed = true;
            }

            if self.url != other.url {
                self.url = other.url;
                changed = true;
            }

            if self.title != other.title {
                self.title = other.title;
                changed = true;
            }

            if self.muted != other.muted {
                self.muted = other.muted;
                changed = true;
            }
        }

        changed
    }
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerializedWindow {
    pub id: WindowId,
    pub name: Option<String>,
    pub timestamp_created: f64,
    pub tabs: Vec<TabId>,
    pub options: WindowOptions,
}

impl SerializedWindow {
    pub fn new(id: WindowId, timestamp_created: f64) -> Self {
        Self {
            id,
            name: None,
            timestamp_created,
            tabs: vec![],
            options: WindowOptions::new(),
        }
    }

    pub fn key(id: &WindowId) -> String {
        format!("window-ids.{}", id.as_str())
    }

    pub fn tab_index(&self, tab_id: &TabId) -> Option<usize> {
        self.tabs.iter().position(|x| *x == *tab_id)
    }

    // TODO ensure that tab IDs are unique across windows
    pub fn merge(&mut self, other: Self) -> bool {
        assert_eq!(self.id, other.id);

        let mut changed = false;

        // TODO update name based on timestamp_updated
        if self.name != other.name {
            self.name = other.name;
            changed = true;
        }

        if other.timestamp_created < self.timestamp_created {
            self.timestamp_created = other.timestamp_created;
            changed = true;
        }

        if self.options.merge(other.options) {
            changed = true;
        }

        if merge_ids(&mut self.tabs, &other.tabs) {
            changed = true;
        }

        changed
    }
}


#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Hash)]
pub enum TabStatus {
    New,
    Loading,
    Complete,
    Discarded,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tab {
    pub serialized: SerializedTab,
    pub focused: bool,
    pub playing_audio: bool,
    pub has_attention: bool,
    pub status: Option<TabStatus>,
}

impl Tab {
    pub fn unloaded(serialized: SerializedTab) -> Self {
        Self {
            serialized,
            focused: false,
            playing_audio: false,
            has_attention: false,
            status: None,
        }
    }
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Window {
    pub serialized: SerializedWindow,
    pub focused: bool,
}
