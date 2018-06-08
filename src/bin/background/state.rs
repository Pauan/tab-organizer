use stdweb::web::Date;
use stdweb::PromiseFuture;
use stdweb::web::error::Error;
use serde_json;
use std::collections::HashMap;
use web_extensions::windows;
use web_extensions::windows::{TabId, WindowId};
use tab_organizer::generate_uuid;
use tab_organizer::state::{SerializedTab, SerializedWindow, Tab, Window};
use serializer::{Serializer, Transaction};
use futures::prelude::*;
use futures::future::join_all;


#[derive(Debug, Serialize, Deserialize)]
pub struct SerializedState {

}

impl SerializedState {
    pub fn new() -> Self {
        Self {

        }
    }
}


struct TabInfo {
    id: TabId,
    info: windows::Tab,
    serialized: SerializedTab,
}

struct WindowInfo {
    id: WindowId,
    info: windows::Window,
    serialized: SerializedWindow,
    tabs: Vec<TabInfo>,
}


#[derive(Debug)]
pub struct State {
    serialized: Serializer<SerializedState>,
    windows_by_id: HashMap<WindowId, Window>,
    tabs_by_id: HashMap<TabId, Tab>,
    windows: Vec<WindowId>,
}

impl State {
    pub fn new(serialized: SerializedState) -> Self {
        Self {
            serialized: Serializer::new(serialized, 1000, "state"),
            windows_by_id: HashMap::new(),
            tabs_by_id: HashMap::new(),
            windows: Vec::new(),
        }
    }


    pub fn set_window_data(id: WindowId, data: &SerializedWindow) -> PromiseFuture<()> {
        windows::Window::set_persistent_data(id, "state", &serde_json::to_string(data).unwrap())
    }

    // TODO handle version + migration
    #[async]
    fn get_window_data(id: WindowId, now: f64) -> Result<SerializedWindow, Error> {
        match await!(windows::Window::get_persistent_data(id, "state"))? {
            Some(data) => {
                Ok(serde_json::from_str(&data).unwrap())
            },
            None => {
                let window = SerializedWindow {
                    id: generate_uuid(),
                    timestamp_created: now,
                };

                await!(State::set_window_data(id, &window))?;

                Ok(window)
            },
        }
    }


    pub fn set_tab_data(id: TabId, data: &SerializedTab) -> PromiseFuture<()> {
        windows::Tab::set_persistent_data(id, "state", &serde_json::to_string(data).unwrap())
    }

    // TODO handle version + migration
    #[async]
    fn get_tab_data(id: TabId, now: f64) -> Result<SerializedTab, Error> {
        match await!(windows::Tab::get_persistent_data(id, "state"))? {
            Some(data) => {
                Ok(serde_json::from_str(&data).unwrap())
            },
            None => {
                let tab = SerializedTab {
                    id: generate_uuid(),
                    timestamp_created: now,
                };

                await!(State::set_tab_data(id, &tab))?;

                Ok(tab)
            },
        }
    }


    pub fn get_windows_info() -> impl Future<Item = Vec<WindowInfo>, Error = Error> {
        let now = Date::now();

        windows::get_all(true, &[windows::WindowKind::Normal]).and_then(|windows| {
            join_all(windows.into_iter().map(|info| async_block! {
                let id = info.id();

                let (serialized, tabs) = await!(
                    State::get_window_data(id, now).join(
                    info.tabs().map(|tabs|
                        join_all(tabs.into_iter().map(|info| async_block! {
                            let id = info.id();

                            let serialized = await!(State::get_tab_data(id, now))?;

                            Ok(TabInfo { id, info, serialized })
                        }))))
                )?;

                Ok(WindowInfo { id, info, serialized, tabs: tabs.unwrap_or_else(Vec::new) })
            }))
        })
    }

    pub fn initialize_windows(&mut self, windows: Vec<WindowInfo>) {
        self.windows = windows.into_iter().map(|window| {
            let id = window.id;

            let window = Window {
                id,
                serialized: window.serialized,
                focused: window.info.is_focused(),
                tabs: window.tabs.into_iter().map(|tab| {
                    let id = tab.id;

                    let tab = Tab {
                        id,
                        serialized: tab.serialized,
                        focused: tab.info.is_focused(),
                        discarded: tab.info.is_discarded(),
                        pinned: tab.info.is_pinned(),
                        index: tab.info.index(),
                        favicon_url: tab.info.favicon_url(),
                        url: tab.info.url(),
                    };

                    assert!(self.tabs_by_id.insert(id, tab).is_none());

                    id
                }).collect(),
            };

            assert!(self.windows_by_id.insert(id, window).is_none());

            id
        }).collect();
    }


    pub fn transaction<A, F>(&self, f: F) -> A where F: FnOnce(Transaction<SerializedState>) -> A {
        self.serialized.transaction(f)
    }
}
