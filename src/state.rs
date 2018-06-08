use uuid::Uuid;
use web_extensions::windows;


#[derive(Debug, Serialize, Deserialize)]
pub struct SerializedTab {
    id: Uuid,
    timestamp_created: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SerializedWindow {
    id: Uuid,
    timestamp_created: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Tab {
    serialized: SerializedTab,
    id: windows::TabId,
    focused: bool,
    discarded: bool,
    pinned: bool,
    index: u32,
    favicon_url: Option<String>,
    url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Window {
    serialized: SerializedWindow,
    id: windows::WindowId,
    focused: bool,
    tabs: Vec<windows::TabId>,
}
