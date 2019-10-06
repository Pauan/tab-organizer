#![feature(vec_remove_item, option_unwrap_none)]
#![warn(unreachable_pub)]

use wasm_bindgen::prelude::*;
use std::rc::Rc;
use std::cell::{Cell, RefCell};
use std::collections::HashMap;
use uuid::Uuid;
use futures::try_join;
use futures::future::try_join_all;
use futures::stream::{StreamExt, TryStreamExt};
use web_extension::browser;
use wasm_bindgen::{intern, JsCast};
use wasm_bindgen_futures::futures_0_3::JsFuture;
use js_sys::{Array, Date};
use dominator::clone;
use serde::Serialize;
use tab_organizer::{spawn, log, object, serialize, deserialize_str, serialize_str, Listener, Windows, Database, on_connect, Port, WindowChange};
use tab_organizer::state::{Window, Tab, SidebarMessage, BackgroundMessage, SerializedWindow, SerializedTab};


#[wasm_bindgen(start)]
pub fn main_js() {
    //#[cfg(debug_assertions)]
    std::panic::set_hook(Box::new(console_error_panic_hook::hook));


    /*struct Serialized {
        version: u32,
    }

    impl Serialized {
        fn new(tx: &Transaction) -> Self {
            Self {
                version: tx.get(intern("version")).unwrap_or(0),
            }
        }
    }*/


    fn merge_ids(ids: &mut Vec<Uuid>, new_ids: &[Uuid]) -> bool {
        let mut old_position = None;

        let mut touched = false;

        for new_id in new_ids {
            let index = ids.iter().position(|old_id| *old_id == *new_id);

            let new_position = index.unwrap_or_else(|| ids.len());

            // If the id doesn't currently exist
            if let None = index {
                ids.push(*new_id);
                touched = true;
            }

            if let Some(old_position) = old_position {
                assert!(old_position < new_position);
            }

            old_position = Some(new_position);
        }

        touched
    }


    #[derive(Debug)]
    struct BrowserTab {
        uuid: Uuid,
    }

    #[derive(Debug)]
    struct BrowserWindow {
        uuid: Uuid,
        tabs: Vec<Uuid>,
    }

    struct State {
        browser_tabs: HashMap<i32, BrowserTab>,
        browser_windows: HashMap<i32, BrowserWindow>,

        windows_by_id: HashMap<Uuid, Window>,
        tabs_by_id: HashMap<Uuid, Tab>,
        focused_window: Option<Uuid>,

        database: Database,
        ports: HashMap<Uuid, Vec<Port>>,
    }

    impl State {
        fn new(database: Database) -> Rc<RefCell<Self>> {
            Rc::new(RefCell::new(Self {
                browser_tabs: HashMap::new(),
                browser_windows: HashMap::new(),

                windows_by_id: HashMap::new(),
                tabs_by_id: HashMap::new(),
                focused_window: None,

                database,
                ports: HashMap::new(),
            }))
        }

        async fn initialize(state: &Rc<RefCell<Self>>, windows: Vec<web_extension::Window>) -> Result<(), JsValue> {
            // TODO increment this for each window/tab ?
            let timestamp_created = Date::now();

            // TODO make this faster ?
            let new_windows: Vec<Uuid> = try_join_all(windows
                .into_iter()
                .map(|x| Self::new_window(state, timestamp_created, x))).await?;

            let state = state.borrow();

            state.database.transaction(|tx| {
                let mut window_ids: Vec<Uuid> = tx.get_or_insert(intern("windows"), || vec![]);

                let changed = merge_ids(&mut window_ids, &new_windows);

                if changed {
                    tx.set(intern("windows"), &window_ids);
                }
            });

            Ok(())
        }

        fn tab_key(uuid: Uuid) -> String {
            format!("tab-ids.{}", uuid)
        }

        async fn new_tab(state: &Rc<RefCell<Self>>, timestamp_created: f64, tab: web_extension::Tab) -> Result<Uuid, JsValue> {
            let tab_id = tab.id().unwrap_throw();

            let uuid = Tab::get_id(tab_id).await?;

            let mut state = state.borrow_mut();

            let serialized = state.database.transaction(|tx| {
                let key = Self::tab_key(uuid);

                let mut serialized: SerializedTab = tx.get_or_insert(&key, || {
                    SerializedTab {
                        id: uuid,
                        tags: vec![],
                        timestamp_created,
                        timestamp_focused: None,
                        pinned: false,
                        unloaded: false,
                        favicon_url: None,
                        url: None,
                        title: None,
                    }
                });

                let changes = serialized.update(&tab);

                let mut changed = !changes.is_empty();

                if tab.active() && serialized.timestamp_focused.is_none() {
                    changed = true;
                    serialized.timestamp_focused = Some(timestamp_created);
                }

                if changed {
                    tx.set(&key, &serialized);
                }

                serialized
            });

            state.tabs_by_id.insert(uuid, Tab {
                serialized,
                id: tab_id,
                focused: tab.active(),
            }).unwrap_none();

            state.browser_tabs.insert(tab_id, BrowserTab { uuid }).unwrap_none();

            Ok(uuid)
        }

        async fn tabs(state: &Rc<RefCell<Self>>, timestamp_created: f64, tabs: Option<Array>) -> Result<Vec<Uuid>, JsValue> {
            if let Some(tabs) = tabs {
                // TODO make this faster ?
                try_join_all(tabs
                    .values()
                    .into_iter()
                    .map(|x| Self::new_tab(state, timestamp_created, x.unwrap_throw().unchecked_into()))).await

            } else {
                Ok(vec![])
            }
        }

        fn window_key(uuid: Uuid) -> String {
            format!("window-ids.{}", uuid)
        }

        async fn new_window(state: &Rc<RefCell<Self>>, timestamp_created: f64, window: web_extension::Window) -> Result<Uuid, JsValue> {
            let window_id = window.id().unwrap_throw();

            let (uuid, tabs) = try_join!(
                Window::get_id(window_id),
                Self::tabs(state, timestamp_created, window.tabs()),
            )?;

            let mut state = state.borrow_mut();

            let serialized: SerializedWindow = state.database.transaction(|tx| {
                let key = Self::window_key(uuid);

                let mut serialized = tx.get_or_insert(&key, || {
                    SerializedWindow {
                        id: uuid,
                        name: None,
                        timestamp_created,
                        tabs: vec![],
                    }
                });

                let changed = merge_ids(&mut serialized.tabs, &tabs);

                if changed {
                    tx.set(&key, &serialized);
                }

                serialized
            });

            let window = Window {
                id: window_id,
                serialized,
                focused: window.focused(),
            };

            if window.focused {
                state.focused_window = Some(uuid);
            }

            state.windows_by_id.insert(uuid, window).unwrap_none();

            state.browser_windows.insert(window_id, BrowserWindow {
                uuid,
                tabs,
            }).unwrap_none();

            state.ports.insert(uuid, vec![]).unwrap_none();

            let _ = JsFuture::from(browser.sidebar_action().set_panel(&object! {
                "panel": format!("sidebar.html?{}", serialize_str(&uuid)),
                "windowId": window_id,
            })).await?;

            Ok(uuid)
        }

        fn insert_tab(&mut self, tab_uuid: Uuid, new_window_id: i32, new_index: u32) {
            let browser_window = self.browser_windows.get_mut(&new_window_id).unwrap_throw();
            let window_uuid = browser_window.uuid;
            let window = self.windows_by_id.get_mut(&window_uuid).unwrap_throw();
            let new_index = new_index as usize;

            let tab_index = if let Some(new_uuid) = browser_window.tabs.get(new_index) {
                window.serialized.tabs.iter().position(|x| *x == *new_uuid).unwrap_throw()

            } else {
                0
            };

            browser_window.tabs.insert(new_index, tab_uuid);
            window.serialized.tabs.insert(tab_index, tab_uuid);

            self.database.transaction(|tx| {
                tx.set(&State::window_key(window_uuid), &window.serialized);
            });

            let tab = self.tabs_by_id.get(&tab_uuid).unwrap_throw();

            // TODO figure out a way to avoid this clone
            self.send_message(window_uuid, &BackgroundMessage::TabInserted { tab_index, tab: tab.clone() });
        }

        fn send_message<A>(&self, uuid: Uuid, message: &A) where A: Serialize {
            let ports = self.ports.get(&uuid).unwrap_throw();

            if !ports.is_empty() {
                let message = serialize(&message);

                for port in ports {
                    port.send_message_raw(&message);
                }
            }
        }
    }


    spawn(async {
        log!("Starting");

        let (windows, database) = try_join!(
            Windows::current(),
            Database::new(),
        )?;

        let state = State::new(database);

        log!("Initializing state");

        State::initialize(&state, windows).await?;

        log!("Initializing listeners");


        spawn(clone!(state => async move {
            on_connect()
                .map(|x| -> Result<Port, JsValue> { Ok(x) })
                .try_for_each_concurrent(None, move |port| {
                    clone!(state => async move {
                        let port_uuid = Rc::new(Cell::new(None));

                        port.on_message()
                            .map(|x| -> Result<SidebarMessage, JsValue> { Ok(x) })
                            .try_for_each(clone!(port_uuid, state, port => move |message| {
                                clone!(port_uuid, state, port => async move {
                                    match message {
                                        SidebarMessage::Initialize { id } => {
                                            let uuid: Uuid = deserialize_str(&id);

                                            let mut state = state.borrow_mut();

                                            {
                                                let ports = state.ports.get_mut(&uuid).unwrap_throw();
                                                ports.push(port.clone());
                                            }

                                            port_uuid.set(Some(uuid));

                                            let window = state.windows_by_id.get(&uuid).unwrap_throw();

                                            // TODO figure out a way to avoid this clone
                                            let tabs: Vec<Tab> = window.serialized.tabs.iter()
                                                .map(|id| state.tabs_by_id.get(id).unwrap_throw().clone())
                                                .collect();

                                            port.send_message(&BackgroundMessage::Initial { tabs });

                                            /*Ok((0..1000).map(|index| {
                                                shared::Tab {
                                                    serialized: shared::SerializedTab {
                                                        id: generate_uuid(),
                                                        timestamp_created: Date::now() - (index as f64 * TimeDifference::HOUR),
                                                        timestamp_focused: Date::now() - (index as f64 * TimeDifference::HOUR),
                                                        tags: vec![
                                                            shared::Tag {
                                                                name: if index < 5 { "One".to_string() } else { "Two".to_string() },
                                                                timestamp_added: index as f64,
                                                            },
                                                        ],
                                                    },
                                                    focused: index == 7,
                                                    unloaded: index == 5,
                                                    pinned: index == 0 || index == 1 || index == 2,
                                                    favicon_url: Some("http://www.saltybet.com/favicon.ico".to_owned()),
                                                    url: Some("https://www.example.com/foo?bar#qux".to_owned()),
                                                    title: Some(format!("Foo {}", index)),
                                                }
                                            }).collect())


                                            Ok(shared::Window {
                                                serialized: shared::SerializedWindow {
                                                    id: generate_uuid(),
                                                    name: None,
                                                    timestamp_created: Date::now(),
                                                    tabs: vec![],
                                                },
                                                focused: false,
                                                tabs: ,
                                            })*/
                                        },
                                    }

                                    Ok(()) as Result<(), JsValue>
                                })
                            })).await?;

                        log!("Port stopped {:?}", port_uuid);

                        if let Some(uuid) = port_uuid.get() {
                            let mut state = state.borrow_mut();
                            let ports = state.ports.get_mut(&uuid).unwrap_throw();
                            ports.remove_item(&port);
                        }

                        Ok(())
                    })
                }).await?;

            Ok(())
        }));


        spawn(async move {
            Windows::changes()
                .map(|x| -> Result<WindowChange, JsValue> { Ok(x) })
                .try_for_each(move |change| {
                    clone!(state => async move {
                        match change {
                            WindowChange::WindowCreated { window } => {
                                let timestamp_created = Date::now();
                                let uuid = State::new_window(&state, timestamp_created, window).await?;

                                state.borrow().database.transaction(|tx| {
                                    let mut window_ids: Vec<Uuid> = tx.get_or_insert(intern("windows"), || vec![]);

                                    window_ids.push(uuid);

                                    tx.set(intern("windows"), &window_ids);
                                });
                            },

                            // TODO call browser.sidebar_action().set_panel ?
                            WindowChange::WindowRemoved { window_id } => {
                                let mut state = state.borrow_mut();

                                state.database.delay_transactions();

                                let browser_window = state.browser_windows.remove(&window_id).unwrap_throw();

                                assert_eq!(browser_window.tabs.len(), 0);

                                let uuid = browser_window.uuid;

                                let window = state.windows_by_id.remove(&uuid).unwrap_throw();

                                assert_eq!(window.serialized.tabs.len(), 0);

                                state.ports.remove(&uuid).unwrap_throw();

                                state.database.transaction(|tx| {
                                    tx.remove(&State::window_key(uuid));

                                    let mut window_ids: Vec<Uuid> = tx.get_or_insert(intern("windows"), || vec![]);

                                    window_ids.remove_item(&uuid);

                                    tx.set(intern("windows"), &window_ids);
                                });
                            },

                            WindowChange::WindowFocused { window_id } => {
                                let state: &mut State = &mut state.borrow_mut();

                                if let Some(uuid) = state.focused_window {
                                    let window = state.windows_by_id.get_mut(&uuid).unwrap_throw();
                                    window.focused = false;
                                    state.focused_window = None;
                                }

                                if let Some(window_id) = window_id {
                                    let uuid = state.browser_windows.get(&window_id).unwrap_throw().uuid;
                                    let window = state.windows_by_id.get_mut(&uuid).unwrap_throw();
                                    window.focused = true;
                                    state.focused_window = Some(uuid);
                                }
                            },

                            WindowChange::TabCreated { tab } => {
                                let timestamp_created = Date::now();
                                let window_id = tab.window_id();
                                let index = tab.index();
                                let tab_uuid = State::new_tab(&state, timestamp_created, tab).await?;
                                state.borrow_mut().insert_tab(tab_uuid, window_id, index);
                            },

                            WindowChange::TabFocused { old_tab_id, new_tab_id, window_id } => {
                                let timestamp_focused = Date::now();

                                let state: &mut State = &mut state.borrow_mut();

                                let old_tab_uuid = old_tab_id.map(|old_tab_id| state.browser_tabs.get(&old_tab_id).unwrap_throw().uuid);
                                let new_tab_uuid = state.browser_tabs.get(&new_tab_id).unwrap_throw().uuid;

                                if let Some(old_tab_uuid) = old_tab_uuid {
                                    state.tabs_by_id.get_mut(&old_tab_uuid).unwrap_throw().focused = false;
                                }

                                let tab = state.tabs_by_id.get_mut(&new_tab_uuid).unwrap_throw();
                                tab.focused = true;
                                tab.serialized.timestamp_focused = Some(timestamp_focused);

                                let window_uuid = state.browser_windows.get_mut(&window_id).unwrap_throw().uuid;
                                let window = state.windows_by_id.get_mut(&window_uuid).unwrap_throw();

                                // TODO use uuid instead of indexes ?
                                let old_tab_index = old_tab_uuid.map(|old_tab_uuid| window.serialized.tabs.iter().position(|x| *x == old_tab_uuid).unwrap_throw());
                                let new_tab_index = window.serialized.tabs.iter().position(|x| *x == new_tab_uuid).unwrap_throw();

                                state.database.transaction(|tx| {
                                    tx.set(&State::tab_key(new_tab_uuid), &tab.serialized);
                                });

                                state.send_message(window_uuid, &BackgroundMessage::TabFocused { old_tab_index, new_tab_index, new_timestamp_focused: timestamp_focused });
                            },

                            WindowChange::TabDetached { tab_id, old_window_id, old_index } => {
                                let state: &mut State = &mut state.borrow_mut();

                                let tab_uuid = state.browser_tabs.get(&tab_id).unwrap_throw().uuid;

                                let browser_window = state.browser_windows.get_mut(&old_window_id).unwrap_throw();
                                let window_uuid = browser_window.uuid;
                                let window = state.windows_by_id.get_mut(&window_uuid).unwrap_throw();

                                assert_eq!(browser_window.tabs.remove(old_index as usize), tab_uuid);

                                let tab_index = window.serialized.tabs.iter().position(|x| *x == tab_uuid).unwrap_throw();
                                window.serialized.tabs.remove(tab_index);

                                state.database.transaction(|tx| {
                                    tx.set(&State::window_key(window_uuid), &window.serialized);
                                });

                                state.send_message(window_uuid, &BackgroundMessage::TabRemoved { tab_index });
                            },

                            WindowChange::TabAttached { tab_id, new_window_id, new_index } => {
                                let state: &mut State = &mut state.borrow_mut();
                                let tab_uuid = state.browser_tabs.get(&tab_id).unwrap_throw().uuid;
                                state.insert_tab(tab_uuid, new_window_id, new_index);
                            },

                            WindowChange::TabMoved { tab_id: _, window_id, old_index, new_index } => {
                                if old_index != new_index {
                                    let state: &mut State = &mut state.borrow_mut();

                                    let browser_window = state.browser_windows.get_mut(&window_id).unwrap_throw();
                                    let window_uuid = browser_window.uuid;
                                    let window = state.windows_by_id.get_mut(&window_uuid).unwrap_throw();

                                    assert!(browser_window.tabs.len() > 1);
                                    assert!(window.serialized.tabs.len() > 1);

                                    let tab_uuid = browser_window.tabs.remove(old_index as usize);
                                    let new_tab_uuid = browser_window.tabs[new_index as usize];
                                    browser_window.tabs.insert(new_index as usize, tab_uuid);

                                    let old_tab_index = window.serialized.tabs.iter().position(|x| *x == tab_uuid).unwrap_throw();
                                    window.serialized.tabs.remove(old_tab_index);
                                    let new_tab_index = window.serialized.tabs.iter().position(|x| *x == new_tab_uuid).unwrap_throw();
                                    window.serialized.tabs.insert(new_tab_index, tab_uuid);

                                    state.database.transaction(|tx| {
                                        tx.set(&State::window_key(window_uuid), &window.serialized);
                                    });

                                    state.send_message(window_uuid, &BackgroundMessage::TabMoved { old_tab_index, new_tab_index });
                                }
                            },

                            WindowChange::TabUpdated { tab: browser_tab } => {
                                let state: &mut State = &mut state.borrow_mut();

                                let tab_uuid = state.browser_tabs.get(&browser_tab.id().unwrap_throw()).unwrap_throw().uuid;
                                let tab = state.tabs_by_id.get_mut(&tab_uuid).unwrap_throw();

                                let changes = tab.serialized.update(&browser_tab);

                                if !changes.is_empty() {
                                    let window_uuid = state.browser_windows.get(&browser_tab.window_id()).unwrap_throw().uuid;
                                    let window = state.windows_by_id.get(&window_uuid).unwrap_throw();

                                    // TODO use tab id instead of index ?
                                    let tab_index = window.serialized.tabs.iter().position(|x| *x == tab_uuid).unwrap_throw();

                                    state.database.transaction(|tx| {
                                        tx.set(&State::tab_key(tab_uuid), &tab.serialized);
                                    });

                                    state.send_message(window_uuid, &BackgroundMessage::TabChanged { tab_index, changes });
                                }
                            },

                            WindowChange::TabRemoved { tab_id, window_id, is_window_closing } => {
                                let state: &mut State = &mut state.borrow_mut();

                                if is_window_closing {
                                    state.database.delay_transactions();
                                }

                                let browser_window = state.browser_windows.get_mut(&window_id).unwrap_throw();
                                let window_uuid = browser_window.uuid;
                                let window = state.windows_by_id.get_mut(&window_uuid).unwrap_throw();

                                let tab_uuid = state.browser_tabs.remove(&tab_id).unwrap_throw().uuid;

                                browser_window.tabs.remove_item(&tab_uuid);
                                state.tabs_by_id.remove(&tab_uuid);

                                let tab_index = window.serialized.tabs.iter().position(|x| *x == tab_uuid).unwrap_throw();
                                window.serialized.tabs.remove(tab_index);

                                state.database.transaction(|tx| {
                                    tx.remove(&State::tab_key(tab_uuid));
                                    tx.set(&State::window_key(window_uuid), &window.serialized);
                                });

                                state.send_message(window_uuid, &BackgroundMessage::TabRemoved { tab_index });
                            },
                        }

                        Ok(())
                    })
                }).await?;

            Ok(())
        });


        Listener::new(browser.browser_action().on_clicked(), Closure::wrap(Box::new(move |_: JsValue| {
            let promise = browser.sidebar_action().open();

            spawn(async move {
                let _ = JsFuture::from(promise).await?;
                Ok(())
            });
        }) as Box<dyn FnMut(JsValue)>)).forget();


        /*{
            let promise = browser.sidebar_action().open();

            spawn(async move {
                let _ = JsFuture::from(promise).await?;
                Ok(())
            });
        }*/


        log!("Backrgound page started");
        Ok(())
    });
}
