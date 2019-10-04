#![warn(unreachable_pub)]

use wasm_bindgen::prelude::*;
use std::rc::Rc;
use std::cell::RefCell;
use std::collections::HashMap;
use uuid::Uuid;
use futures::try_join;
use futures::future::try_join_all;
use futures::stream::StreamExt;
use web_extension::browser;
use wasm_bindgen::{intern, JsCast};
use wasm_bindgen_futures::futures_0_3::JsFuture;
use js_sys::{Array, Date};
use tab_organizer::{spawn, log, object, deserialize_str, serialize_str, Listener, Windows, Database};
use tab_organizer::state::{Window, Tab, SidebarMessage, SerializedWindow, SerializedTab};


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


    struct State {
        browser_tabs: HashMap<i32, Uuid>,
        browser_windows: HashMap<i32, Uuid>,

        windows_by_id: HashMap<Uuid, Window>,
        tabs_by_id: HashMap<Uuid, Tab>,
        windows: Vec<Uuid>,

        database: Database,
    }

    impl State {
        fn new(database: Database) -> Rc<RefCell<Self>> {
            Rc::new(RefCell::new(Self {
                browser_tabs: HashMap::new(),
                browser_windows: HashMap::new(),

                windows_by_id: HashMap::new(),
                tabs_by_id: HashMap::new(),
                windows: vec![],

                database,
            }))
        }

        async fn initialize(state: &Rc<RefCell<Self>>, windows: Vec<web_extension::Window>) -> Result<(), JsValue> {
            // TODO increment this for each window/tab ?
            let timestamp_created = Date::now();

            // TODO make this faster ?
            let new_windows: Vec<Uuid> = try_join_all(windows
                .into_iter()
                .map(|x| Self::new_window(state, timestamp_created, x))).await?;

            let mut state = state.borrow_mut();

            let window_ids = state.database.transaction(|tx| {
                let mut window_ids: Vec<Uuid> = tx.get_or_insert(intern("windows"), || vec![]);

                let changed = merge_ids(&mut window_ids, &new_windows);

                if changed {
                    tx.set(intern("windows"), &window_ids);
                }

                window_ids
            });

            state.windows = window_ids;

            state.database.debug();

            Ok(())
        }

        async fn new_tab(state: &Rc<RefCell<Self>>, timestamp_created: f64, tab: web_extension::Tab) -> Result<Uuid, JsValue> {
            let tab_id = tab.id().unwrap_throw();

            let id = Tab::get_id(tab_id).await?;

            let mut state = state.borrow_mut();

            let serialized = state.database.transaction(|tx| {
                let key = format!("tab-ids.{}", id);

                let mut serialized: SerializedTab = tx.get_or_insert(&key, || {
                    SerializedTab {
                        id,
                        tags: vec![],
                        timestamp_created,
                        timestamp_focused: None,
                        unloaded: false,
                        favicon_url: None,
                        url: None,
                        title: None,
                    }
                });

                let changed = serialized.update(timestamp_created, &tab);

                if changed {
                    tx.set(&key, &serialized);
                }

                serialized
            });

            state.tabs_by_id.insert(id, Tab {
                serialized,
                id: tab_id,
                focused: tab.active(),
                pinned: tab.pinned(),
            });

            state.browser_tabs.insert(tab_id, id);

            Ok(id)
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

        async fn new_window(state: &Rc<RefCell<Self>>, timestamp_created: f64, window: web_extension::Window) -> Result<Uuid, JsValue> {
            let window_id = window.id().unwrap_throw();

            let (id, tabs) = try_join!(
                Window::get_id(window_id),
                Self::tabs(state, timestamp_created, window.tabs()),
            )?;

            log!("{}", id);

            let mut state = state.borrow_mut();

            let serialized: SerializedWindow = state.database.transaction(|tx| {
                let key = format!("window-ids.{}", id);

                let mut serialized = tx.get_or_insert(&key, || {
                    SerializedWindow {
                        id,
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

            state.windows_by_id.insert(id, Window {
                id: window_id,
                serialized,
                focused: window.focused(),
            });

            state.browser_windows.insert(window_id, id);

            let _ = JsFuture::from(browser.sidebar_action().set_panel(&object! {
                "panel": format!("sidebar.html?{}", serialize_str(&id)),
                "windowId": window_id,
            })).await?;

            Ok(id)
        }
    }


    spawn(async {
        let (windows, database) = try_join!(
            Windows::current(),
            Database::new(),
        )?;

        // TODO remove this
        database.transaction(|tx| tx.clear());

        let state = State::new(database);

        State::initialize(&state, windows).await?;

        spawn(async {
            Windows::changes().for_each(|change| {
                log!("{:#?}", change);

                async move {

                }
            }).await;

            Ok(())
        });


        Listener::new(browser.browser_action().on_clicked(), Closure::wrap(Box::new(move |_: JsValue| {
            let promise = browser.sidebar_action().open();

            spawn(async move {
                let _ = JsFuture::from(promise).await?;
                Ok(())
            });
        }) as Box<dyn FnMut(JsValue)>)).forget();


        tab_organizer::on_message(move |message: SidebarMessage| {
            let state = state.clone();

            async move {
                match message {
                    SidebarMessage::Initialize { id } => {
                        let state = state.borrow();
                        let uuid: Uuid = deserialize_str(&id);
                        let window = state.windows_by_id.get(&uuid).unwrap_throw();

                        // TODO figure out a way to avoid this clone
                        let tabs: Vec<Tab> = window.serialized.tabs.iter()
                            .map(|id| state.tabs_by_id.get(id).unwrap_throw().clone())
                            .collect();

                        Ok(tabs)

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
            }
        }).forget();


        log!("Backrgound page started");
        Ok(())
    });
}
