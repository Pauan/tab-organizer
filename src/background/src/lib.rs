#![feature(vec_remove_item, option_unwrap_none)]
#![warn(unreachable_pub)]

use wasm_bindgen::prelude::*;
use std::rc::Rc;
use std::cell::{Cell, RefCell};
use std::collections::{HashMap, HashSet};
use std::collections::hash_map::Entry;
use uuid::Uuid;
use futures::try_join;
use futures::future::try_join_all;
use futures::stream::{StreamExt, TryStreamExt};
use web_extension::browser;
use wasm_bindgen::{intern, JsCast};
use wasm_bindgen_futures::JsFuture;
use js_sys::{Array, Date};
use dominator::clone;
use tab_organizer::{spawn, log, info, object, serialize, deserialize, generate_uuid, deserialize_str, serialize_str, Listener, Windows, Database, on_connect, Port, WindowChange, export_function, closure, print_logs};
use tab_organizer::state::{Tab, SerializedWindow, SerializedTab, sidebar, options};

mod migrate;


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
struct Mapping<A> {
    ids: HashMap<i32, Uuid>,
    values: HashMap<Uuid, A>,
}

impl<A> Mapping<A> {
    fn new() -> Self {
        Self {
            ids: HashMap::new(),
            values: HashMap::new(),
        }
    }

    fn get_uuid(&mut self, uuid: Uuid) -> Option<&mut A> {
        self.values.get_mut(&uuid)
    }

    fn get_id(&mut self, id: i32) -> Option<&mut A> {
        let ids = &self.ids;
        let values = &mut self.values;
        ids.get(&id).map(move |uuid| values.get_mut(uuid).unwrap())
    }

    fn get_or_insert<F>(&mut self, id: i32, uuid: Uuid, set: F) -> &mut A where F: FnOnce() -> A {
        let entry = self.values.entry(uuid);

        match entry {
            Entry::Vacant(_) => {
                self.ids.insert(id, uuid).unwrap_none();
            },
            Entry::Occupied(_) => {
                assert_eq!(*self.ids.get(&id).unwrap(), uuid);
            },
        }

        entry.or_insert_with(set)
    }

    fn remove(&mut self, id: i32) -> Option<A> {
        let uuid = self.ids.remove(&id)?;
        let value = self.values.remove(&uuid).unwrap();
        Some(value)
    }

    fn move_id(&mut self, old_id: i32, new_id: i32) {
        if let Some(uuid) = self.ids.remove(&old_id) {
            self.ids.insert(new_id, uuid).unwrap_none();
        }
    }
}

impl<A> Mapping<A> where A: std::fmt::Debug {
    fn insert(&mut self, id: i32, uuid: Uuid, value: A) {
        self.ids.insert(id, uuid).unwrap_none();
        self.values.insert(uuid, value).unwrap_none();
    }
}


#[derive(Debug)]
struct BrowserTab {
    serialized: SerializedTab,
    uuid: Uuid,
    id: i32,
    // TODO this should be Option<i32>
    window_id: i32,
    old_window: Option<Uuid>,

    // Must be synchronized with Tab
    playing_audio: bool,
}

impl BrowserTab {
    async fn get_id(tab_id: i32) -> Result<Uuid, JsValue> {
        //JsFuture::from(browser.sessions().remove_tab_value(tab_id, intern("id"))).await?;

        let id = JsFuture::from(browser.sessions().get_tab_value(tab_id, intern("id"))).await?;

        // TODO better implementation of this ?
        if id.is_undefined() {
            let id = generate_uuid();
            let _ = JsFuture::from(browser.sessions().set_tab_value(tab_id, intern("id"), &serialize(&id))).await?;
            Ok(id)

        } else {
            Ok(deserialize(&id))
        }
    }

    fn to_tab(&self, browser_window: &BrowserWindow) -> Tab {
        Tab {
            // TODO figure out a way to avoid this clone
            serialized: self.serialized.clone(),
            focused: browser_window.is_tab_focused(self.uuid),
            playing_audio: self.playing_audio,
        }
    }
}


#[derive(Debug)]
struct BrowserWindow {
    serialized: SerializedWindow,
    uuid: Uuid,
    id: i32,
    tabs: Vec<Uuid>,
    focused_tab: Option<Uuid>,
    is_unloading: bool,
}

impl BrowserWindow {
    // TODO code duplication
    async fn get_id(window_id: i32) -> Result<Uuid, JsValue> {
        //JsFuture::from(browser.sessions().remove_window_value(window_id, intern("id"))).await?;

        let id = JsFuture::from(browser.sessions().get_window_value(window_id, intern("id"))).await?;

        // TODO better implementation of this ?
        if id.is_undefined() {
            let id = generate_uuid();
            let _ = JsFuture::from(browser.sessions().set_window_value(window_id, intern("id"), &serialize(&id))).await?;
            Ok(id)

        } else {
            Ok(deserialize(&id))
        }
    }

    fn is_tab_focused(&self, tab_uuid: Uuid) -> bool {
        match self.focused_tab {
            Some(uuid) => uuid == tab_uuid,
            None => false,
        }
    }

    fn set_focused(&mut self, new_tab_uuid: Uuid) -> Option<Option<Uuid>> {
        let old_tab_uuid = self.focused_tab;

        if let Some(old_tab_uuid) = old_tab_uuid {
            if old_tab_uuid == new_tab_uuid {
                return None;
            }
        }

        self.focused_tab = Some(new_tab_uuid);

        return Some(old_tab_uuid);
    }

    fn unfocus_tab(&mut self, tab_id: Uuid) {
        if let Some(old_uuid) = self.focused_tab {
            if old_uuid == tab_id {
                self.focused_tab = None;
            }
        }
    }

    fn detach_tab(&mut self, tab_id: Uuid, index: usize) {
        assert_eq!(self.tabs.remove(index), tab_id);

        self.unfocus_tab(tab_id);
    }
}


struct State {
    tab_ids: Mapping<BrowserTab>,
    window_ids: Mapping<BrowserWindow>,
    windows: Vec<Uuid>,

    focused_window: Option<Uuid>,
    unloading_tabs: HashSet<Uuid>,

    database: Database,

    sidebar_ports: HashMap<Uuid, Vec<Port<sidebar::ServerMessage, sidebar::ClientMessage>>>,
    options_ports: Vec<Port<options::ServerMessage, options::ClientMessage>>,
}

impl State {
    fn new(database: Database) -> Rc<RefCell<Self>> {
        Rc::new(RefCell::new(Self {
            tab_ids: Mapping::new(),
            window_ids: Mapping::new(),
            windows: vec![],

            focused_window: None,
            unloading_tabs: HashSet::new(),

            database,

            sidebar_ports: HashMap::new(),
            options_ports: vec![],
        }))
    }

    fn window_key(uuid: Uuid) -> String {
        format!("window-ids.{}", uuid)
    }

    fn tab_key(uuid: Uuid) -> String {
        format!("tab-ids.{}", uuid)
    }

    async fn new_tab(state: &Rc<RefCell<Self>>, timestamp_created: f64, tab: web_extension::Tab) -> Result<(Uuid, bool), JsValue> {
        let id = tab.id().unwrap();

        let uuid = BrowserTab::get_id(id).await?;

        let state: &mut State = &mut state.borrow_mut();
        let tab_ids = &mut state.tab_ids;

        let window_id = tab.window_id();
        let focused = tab.active();
        let playing_audio = tab.audible().unwrap_or(false);

        state.database.transaction(|tx| {
            let key = Self::tab_key(uuid);

            let mut browser_tab = BrowserTab {
                serialized: tx.get_or_insert(&key, || SerializedTab::new(uuid, timestamp_created)),
                uuid,
                id,
                window_id,
                old_window: None,
                playing_audio,
            };

            // TODO handle focused better
            let changed = browser_tab.serialized.initialize(&tab, timestamp_created);
            let changes = browser_tab.serialized.update(&tab);

            if changed || !changes.is_empty() {
                tx.set(&key, &browser_tab.serialized);
            }

            tab_ids.insert(id, uuid, browser_tab);
        });

        Ok((uuid, focused))
    }

    async fn tabs(state: &Rc<RefCell<Self>>, timestamp_created: f64, tabs: Option<Array>) -> Result<Vec<(Uuid, bool)>, JsValue> {
        if let Some(tabs) = tabs {
            try_join_all(tabs
                .iter()
                .map(|tab| State::new_tab(state, timestamp_created, tab.unchecked_into()))).await

        } else {
            Ok(vec![])
        }
    }

    async fn new_window(state: &Rc<RefCell<Self>>, timestamp_created: f64, window: &web_extension::Window) -> Result<Uuid, JsValue> {
        let id = window.id().unwrap();

        let (uuid, tabs) = try_join!(
            BrowserWindow::get_id(id),
            Self::tabs(state, timestamp_created, window.tabs()),
        )?;

        {
            let state: &mut State = &mut state.borrow_mut();

            let mut focused_tab = None;

            let tabs: Vec<Uuid> = tabs.into_iter().map(|(uuid, focused)| {
                if focused {
                    assert_eq!(focused_tab, None);
                    focused_tab = Some(uuid);
                }

                uuid
            }).collect();

            let serialized = state.database.transaction(|tx| {
                let key = Self::window_key(uuid);

                let mut serialized = tx.get_or_insert(&key, || SerializedWindow::new(uuid, timestamp_created));

                let changed = merge_ids(&mut serialized.tabs, &tabs);

                if changed {
                    tx.set(&key, &serialized);
                }

                serialized
            });

            state.window_ids.insert(id, uuid, BrowserWindow {
                serialized,
                id,
                uuid,
                tabs,
                focused_tab,
                is_unloading: false,
            });

            if window.focused() {
                state.focused_window = Some(uuid);
            }

            state.sidebar_ports.insert(uuid, vec![]).unwrap_none();
        }

        let _ = JsFuture::from(browser.sidebar_action().set_panel(&object! {
            "panel": format!("sidebar.html?{}", serialize_str(&uuid)),
            "windowId": id,
        })).await?;

        Ok(uuid)
    }

    async fn initialize(state: &Rc<RefCell<Self>>, windows: &[web_extension::Window]) -> Result<(), JsValue> {
        // TODO increment this for each window/tab ?
        let timestamp_created = Date::now();

        // TODO make this faster ?
        let new_windows: Vec<Uuid> = try_join_all(windows
            .into_iter()
            .map(|x| Self::new_window(state, timestamp_created, x))).await?;

        let mut state = state.borrow_mut();

        state.database.transaction(|tx| {
            let mut window_ids: Vec<Uuid> = tx.get_or_insert(intern("windows"), || vec![]);

            let changed = merge_ids(&mut window_ids, &new_windows);

            if changed {
                tx.set(intern("windows"), &window_ids);
            }
        });

        state.windows = new_windows;

        Ok(())
    }

    // TODO code duplication with new_tab
    async fn create_or_update_tab(state: &Rc<RefCell<Self>>, timestamp_created: f64, tab: &web_extension::Tab) -> Result<(), JsValue> {
        let window_id = tab.window_id();
        let window_uuid = state.borrow_mut().window_ids.get_id(window_id).map(|x| x.uuid);

        // Verify that it's a normal window
        if let Some(window_uuid) = window_uuid {
            let id = tab.id().unwrap();

            let uuid = BrowserTab::get_id(id).await?;

            let state: &mut State = &mut state.borrow_mut();

            // TODO handle focused
            let focused = tab.active();
            let playing_audio = tab.audible().unwrap_or(false);

            let browser_window = state.window_ids.get_uuid(window_uuid).unwrap();

            let mut is_new = false;

            let (serialized, mut changes) = state.database.transaction(|tx| {
                let key = Self::tab_key(uuid);

                let mut serialized = tx.get_or_insert(&key, || {
                    is_new = true;
                    SerializedTab::new(uuid, timestamp_created)
                });

                let changed = serialized.initialize(&tab, timestamp_created);
                let changes = serialized.update(&tab);

                if changed || !changes.is_empty() {
                    tx.set(&key, &serialized);
                }

                (serialized, changes)
            });

            let browser_tab = state.tab_ids.get_or_insert(id, uuid, || BrowserTab {
                serialized,
                id,
                uuid,
                window_id,
                old_window: None,
                playing_audio,
            });

            assert_eq!(browser_tab.window_id, window_id);

            if browser_tab.playing_audio != playing_audio {
                browser_tab.playing_audio = playing_audio;

                changes.push(sidebar::TabChange::PlayingAudio { playing: playing_audio });
            }

            if is_new {
                let tab_index = Self::insert_tab(&state.database, browser_window, browser_tab, tab.index());

                let tab = browser_tab.to_tab(&browser_window);

                state.send_message(window_uuid, &sidebar::ServerMessage::TabInserted {
                    tab_index,
                    tab,
                });

            // TODO what about the focus ?
            } else if !changes.is_empty() {
                let tab_index = browser_window.serialized.tab_index(uuid);

                state.send_message(window_uuid, &sidebar::ServerMessage::TabChanged { tab_index, changes });
            }
        }

        Ok(())
    }

    fn insert_tab(database: &Database, browser_window: &mut BrowserWindow, browser_tab: &mut BrowserTab, new_index: u32) -> usize {
        let window_uuid = browser_window.uuid;
        let new_index = new_index as usize;

        // This finds the nearest browser tab to the right of the new tab
        let tab_index = if let Some(new_uuid) = browser_window.tabs.get(new_index) {
            browser_window.serialized.tab_index(*new_uuid)

        } else {
            // TODO is this correct ?
            browser_window.serialized.tabs.len()
        };

        browser_window.tabs.insert(new_index, browser_tab.uuid);
        browser_window.serialized.tabs.insert(tab_index, browser_tab.uuid);

        database.transaction(|tx| {
            tx.set(&State::window_key(window_uuid), &browser_window.serialized);
        });

        tab_index
    }

    fn send_message(&self, uuid: Uuid, message: &sidebar::ServerMessage) {
        let ports = self.sidebar_ports.get(&uuid).unwrap();

        if !ports.is_empty() {
            let message = serialize(&message);

            for port in ports {
                port.unchecked_send_message(&message);
            }
        }
    }
}


#[wasm_bindgen(start)]
pub async fn main_js() -> Result<(), JsValue> {
    console_error_panic_hook::set_once();


    log!("Starting");


    Listener::new(browser.browser_action().on_clicked(), Closure::wrap(Box::new(move |_: JsValue| {
        let fut = JsFuture::from(browser.sidebar_action().open());

        spawn(async move {
            let _ = fut.await?;
            Ok(())
        });
    }) as Box<dyn FnMut(JsValue)>)).forget();


    export_function("print_logs", closure!(move |amount: usize| {
        print_logs(amount);
    }));


    let (windows, database) = try_join!(
        Windows::current(),
        Database::new(),
    )?;

    database.transaction(|tx| tx.clear());

    migrate::migrate(&database);

    let state = State::new(database);

    log!("Initializing state");

    State::initialize(&state, &windows).await?;

    log!("Initializing listeners");


    spawn(clone!(state => async move {
        on_connect::<sidebar::ServerMessage, sidebar::ClientMessage>("sidebar")
            .map(|x| -> Result<_, JsValue> { Ok(x) })
            .try_for_each_concurrent(None, move |port| {
                clone!(state => async move {
                    let port_uuid = Rc::new(Cell::new(None));

                    port.on_message()
                        .map(|x| -> Result<_, JsValue> { Ok(x) })
                        .try_for_each(clone!(port_uuid, state, port => move |message| {
                            clone!(port_uuid, state, port => async move {
                                match message {
                                    sidebar::ClientMessage::Initialize { id } => {
                                        let uuid: Uuid = deserialize_str(&id);

                                        let state: &mut State = &mut state.borrow_mut();

                                        {
                                            let ports = state.sidebar_ports.get_mut(&uuid).unwrap();
                                            ports.push(port.clone());
                                        }

                                        port_uuid.set(Some(uuid));

                                        let window = state.window_ids.get_uuid(uuid).unwrap();

                                        let tab_ids = &mut state.tab_ids;

                                        // TODO figure out a way to avoid this clone
                                        let tabs: Vec<Tab> = state.database.transaction(|tx| {
                                            window.serialized.tabs.iter()
                                                .map(|id| {
                                                    match tab_ids.get_uuid(*id) {
                                                        Some(tab) => tab.to_tab(&window),

                                                        // Tab is unloaded
                                                        None => {
                                                            let key = State::tab_key(uuid);
                                                            let serialized: SerializedTab = tx.get(&key).unwrap();
                                                            Tab::unloaded(serialized)
                                                        },
                                                    }
                                                })
                                                .collect()
                                        });

                                        port.send_message(&sidebar::ServerMessage::Initial { tabs });
                                    },

                                    sidebar::ClientMessage::ClickTab { id } => {
                                        // TODO can this use unwrap_throw ?
                                        if let Some(tab) = state.borrow_mut().tab_ids.get_uuid(id) {
                                            let fut1 = JsFuture::from(browser.tabs().update(Some(tab.id), &object! {
                                                "active": true,
                                            }));

                                            let fut2 = JsFuture::from(browser.windows().update(tab.window_id, &object! {
                                                "focused": true,
                                            }));

                                            // TODO should this spawn ?
                                            spawn(async {
                                                try_join!(fut1, fut2)?;
                                                Ok(())
                                            });

                                        // The tab is unloaded
                                        } else {
                                        }
                                    },

                                    sidebar::ClientMessage::CloseTabs { ids } => {
                                        let state: &mut State = &mut state.borrow_mut();

                                        let mut close_unloaded = vec![];

                                        let ids = ids.into_iter().filter_map(|id| {
                                            match state.tab_ids.get_uuid(id) {
                                                // TODO can this be made faster ?
                                                Some(tab) => {
                                                    Some(JsValue::from(tab.id))
                                                },

                                                // The tab is unloaded
                                                None => {
                                                    close_unloaded.push(id);
                                                    None
                                                },
                                            }
                                        }).collect::<js_sys::Array>();

                                        let fut = JsFuture::from(browser.tabs().remove(&ids));

                                        // TODO should this spawn ?
                                        spawn(async {
                                            fut.await?;
                                            Ok(())
                                        });

                                        if !close_unloaded.is_empty() {
                                            let window_id = port_uuid.get().unwrap();
                                            let window = state.window_ids.get_uuid(window_id).unwrap();

                                            let tab_indexes = state.database.transaction(|tx| {
                                                let indexes = close_unloaded.into_iter().map(|id| {
                                                    let tab_index = window.serialized.tab_index(id);

                                                    window.serialized.tabs.remove(tab_index);

                                                    // TODO verify that the key already existed
                                                    tx.remove(&State::tab_key(id));

                                                    tab_index
                                                }).collect::<Vec<usize>>();

                                                tx.set(&State::window_key(window_id), &window.serialized);

                                                indexes
                                            });

                                            for tab_index in tab_indexes {
                                                state.send_message(window_id, &sidebar::ServerMessage::TabRemoved { tab_index });
                                            }
                                        }
                                    },

                                    sidebar::ClientMessage::UnloadTabs { ids } => {
                                        let state: &mut State = &mut state.borrow_mut();

                                        let ids = ids.into_iter().filter_map(|id| {
                                            // This will only succeed for tabs which aren't unloaded
                                            let tab = state.tab_ids.get_uuid(id)?;

                                            // TODO should this assert ?
                                            assert!(state.unloading_tabs.insert(id));

                                            Some(JsValue::from(tab.id))
                                        }).collect::<js_sys::Array>();

                                        let fut = JsFuture::from(browser.tabs().remove(&ids));

                                        // TODO should this spawn ?
                                        spawn(async {
                                            fut.await?;
                                            Ok(())
                                        });
                                    },
                                }

                                Ok(()) as Result<(), JsValue>
                            })
                        })).await?;

                    info!("Port stopped {:?}", port_uuid);

                    if let Some(uuid) = port_uuid.get() {
                        let mut state = state.borrow_mut();

                        if let Some(ports) = state.sidebar_ports.get_mut(&uuid) {
                            ports.remove_item(&port).unwrap();
                        }
                    }

                    Ok(())
                })
            }).await
    }));


    spawn(clone!(state => async move {
        on_connect::<options::ServerMessage, options::ClientMessage>("options")
            .map(|x| -> Result<_, JsValue> { Ok(x) })
            .try_for_each_concurrent(None, move |port| {
                clone!(state => async move {
                    state.borrow_mut().options_ports.push(port.clone());

                    port.on_message()
                        .map(|x| -> Result<_, JsValue> { Ok(x) })
                        .try_for_each(clone!(state, port => move |message| {
                            clone!(state, port => async move {
                                match message {
                                    options::ClientMessage::Initialize => {
                                        port.send_message(&options::ServerMessage::Initial);
                                    },
                                }

                                Ok(()) as Result<(), JsValue>
                            })
                        })).await?;

                    state.borrow_mut().options_ports.remove_item(&port).unwrap();

                    Ok(())
                })
            }).await
    }));


    spawn(async move {
        Windows::changes()
            .map(|x| -> Result<WindowChange, JsValue> { Ok(x) })
            .try_for_each(move |change| {
                clone!(state => async move {
                    info!("{:#?}", change);

                    match change {
                        WindowChange::WindowCreated { window } => {
                            let timestamp_created = Date::now();

                            if window.type_().map(|x| x == "normal").unwrap_or(false) {
                                let uuid = State::new_window(&state, timestamp_created, &window).await?;

                                state.borrow().database.transaction(|tx| {
                                    let mut window_ids: Vec<Uuid> = tx.get_or_insert(intern("windows"), || vec![]);

                                    window_ids.push(uuid);

                                    tx.set(intern("windows"), &window_ids);
                                });
                            }
                        },

                        // TODO call browser.sidebar_action().set_panel ?
                        WindowChange::WindowRemoved { window_id } => {
                            let mut state = state.borrow_mut();

                            if let Some(browser_window) = state.window_ids.remove(window_id) {
                                state.database.delay_transactions();

                                assert_eq!(browser_window.tabs.len(), 0);

                                let uuid = browser_window.uuid;

                                state.sidebar_ports.remove(&uuid).unwrap();

                                if !browser_window.is_unloading {
                                    state.database.transaction(|tx| {
                                        // These are only unloaded tabs
                                        for id in browser_window.serialized.tabs {
                                            // TODO verify that the key already existed
                                            tx.remove(&State::tab_key(id));
                                        }

                                        tx.remove(&State::window_key(uuid));

                                        let mut window_ids: Vec<Uuid> = tx.get_or_insert(intern("windows"), || vec![]);

                                        window_ids.remove_item(&uuid).unwrap();

                                        tx.set(intern("windows"), &window_ids);
                                    });
                                }
                            }
                        },

                        WindowChange::WindowFocused { window_id } => {
                            let state: &mut State = &mut state.borrow_mut();

                            if let Some(window_id) = window_id {
                                // TODO this only needs to lookup the Uuid, not the entire BrowserWindow
                                if let Some(browser_window) = state.window_ids.get_id(window_id) {
                                    state.focused_window = Some(browser_window.uuid);

                                } else {
                                    state.focused_window = None;
                                }

                            } else {
                                state.focused_window = None;
                            }
                        },

                        WindowChange::TabCreated { tab } => {
                            let timestamp = Date::now();
                            State::create_or_update_tab(&state, timestamp, &tab).await?;
                        },

                        WindowChange::TabUpdated { tab } => {
                            let timestamp = Date::now();
                            State::create_or_update_tab(&state, timestamp, &tab).await?;
                        },

                        // TODO put in asserts that the old_tab_id matches ?
                        WindowChange::TabFocused { old_tab_id: _, new_tab_id, window_id } => {
                            let timestamp_focused = Date::now();

                            let state: &mut State = &mut state.borrow_mut();

                            if let Some(browser_window) = state.window_ids.get_id(window_id) {
                                let browser_tab = state.tab_ids.get_id(new_tab_id).unwrap();

                                let uuid = browser_tab.uuid;
                                let browser_uuid = browser_window.uuid;

                                let old_tab_uuid = browser_window.set_focused(uuid).unwrap();

                                state.database.transaction(|tx| {
                                    browser_tab.serialized.timestamp_focused = Some(timestamp_focused);

                                    tx.set(&State::tab_key(uuid), &browser_tab.serialized);
                                });

                                let old_tab_index = old_tab_uuid.map(|x| browser_window.serialized.tab_index(x));
                                let new_tab_index = browser_window.serialized.tab_index(uuid);

                                state.send_message(browser_uuid, &sidebar::ServerMessage::TabFocused {
                                    old_tab_index,
                                    new_tab_index,
                                    new_timestamp_focused: timestamp_focused,
                                });
                            }
                        },

                        WindowChange::TabDetached { tab_id, old_window_id, old_index } => {
                            let state: &mut State = &mut state.borrow_mut();

                            if let Some(browser_window) = state.window_ids.get_id(old_window_id) {
                                let browser_tab = state.tab_ids.get_id(tab_id).unwrap();

                                browser_tab.old_window = Some(browser_window.uuid);

                                browser_window.detach_tab(browser_tab.uuid, old_index as usize);
                            }
                        },

                        // TODO handle tab focus
                        WindowChange::TabAttached { tab_id, new_window_id, new_index } => {
                            let state: &mut State = &mut state.borrow_mut();

                            if let Some(browser_tab) = state.tab_ids.get_id(tab_id) {
                                let old_window_id = browser_tab.old_window.take().unwrap();

                                // TODO is this correct if the old window no longer exists ?
                                if let Some(old_window) = state.window_ids.get_uuid(old_window_id) {
                                    let tab_index = old_window.serialized.tab_index(browser_tab.uuid);

                                    assert_eq!(old_window.serialized.tabs.remove(tab_index), browser_tab.uuid);

                                    state.database.transaction(|tx| {
                                        tx.set(&State::window_key(old_window.uuid), &old_window.serialized);
                                    });

                                    state.send_message(old_window_id, &sidebar::ServerMessage::TabRemoved { tab_index });
                                }
                            }

                            if let Some(browser_window) = state.window_ids.get_id(new_window_id) {
                                let browser_tab = state.tab_ids.get_id(tab_id).unwrap();

                                let browser_uuid = browser_window.uuid;

                                browser_tab.window_id = browser_window.id;

                                let tab_index = State::insert_tab(&state.database, browser_window, browser_tab, new_index);

                                let tab = browser_tab.to_tab(&browser_window);

                                state.send_message(browser_uuid, &sidebar::ServerMessage::TabInserted {
                                    tab_index,
                                    tab,
                                });
                            }
                        },

                        WindowChange::TabMoved { tab_id, window_id, old_index, new_index } => {
                            if old_index != new_index {
                                let state: &mut State = &mut state.borrow_mut();

                                if let Some(browser_window) = state.window_ids.get_id(window_id) {
                                    assert!(browser_window.tabs.len() > 1);
                                    assert!(browser_window.serialized.tabs.len() > 1);

                                    let browser_uuid = browser_window.uuid;

                                    let tab_uuid = browser_window.tabs.remove(old_index as usize);
                                    let browser_tab = state.tab_ids.get_uuid(tab_uuid).unwrap();

                                    assert_eq!(browser_tab.id, tab_id);

                                    let old_tab_index = browser_window.serialized.tab_index(tab_uuid);

                                    browser_window.serialized.tabs.remove(old_tab_index);

                                    // TODO maybe the movement should take into account whether it's moving left or right ?
                                    let new_tab_index = State::insert_tab(&state.database, browser_window, browser_tab, new_index);

                                    state.send_message(browser_uuid, &sidebar::ServerMessage::TabMoved { old_tab_index, new_tab_index });
                                }
                            }
                        },

                        WindowChange::TabReplaced { old_tab_id, new_tab_id } => {
                            let state: &mut State = &mut state.borrow_mut();

                            state.tab_ids.move_id(old_tab_id, new_tab_id);
                        },

                        WindowChange::TabRemoved { tab_id, window_id, is_window_closing } => {
                            let state: &mut State = &mut state.borrow_mut();

                            if let Some(browser_window) = state.window_ids.get_id(window_id) {
                                if is_window_closing {
                                    state.database.delay_transactions();
                                }

                                let mut browser_tab = state.tab_ids.remove(tab_id).unwrap();

                                let window_uuid = browser_window.uuid;
                                let tab_uuid = browser_tab.uuid;

                                browser_window.tabs.remove_item(&tab_uuid).unwrap();
                                browser_window.unfocus_tab(tab_uuid);

                                let tab_index = browser_window.serialized.tab_index(tab_uuid);

                                if state.unloading_tabs.remove(&tab_uuid) {
                                    // TODO change is_unloading to false when a new tab is created in the window ?
                                    // TODO is this check correct ? maybe it should check the tabs.len() instead
                                    if is_window_closing {
                                        browser_window.is_unloading = true;
                                    }

                                    browser_tab.serialized.unloaded = true;

                                    state.database.transaction(|tx| {
                                        tx.set(&State::tab_key(tab_uuid), &browser_tab.serialized);
                                    });

                                    state.send_message(window_uuid, &sidebar::ServerMessage::TabChanged {
                                        tab_index,
                                        changes: vec![
                                            sidebar::TabChange::Unloaded { unloaded: true },
                                        ],
                                    });

                                // TODO maybe if the window is closing then it won't do anything, instead leaving that up to WindowChange::WindowRemoved ?
                                } else {
                                    browser_window.serialized.tabs.remove(tab_index);

                                    state.database.transaction(|tx| {
                                        // TODO verify that the key existed before ?
                                        tx.remove(&State::tab_key(tab_uuid));
                                        tx.set(&State::window_key(window_uuid), &browser_window.serialized);
                                    });

                                    state.send_message(window_uuid, &sidebar::ServerMessage::TabRemoved { tab_index });
                                }
                            }
                        },
                    }

                    Ok(())
                })
            }).await
    });


    log!("Background page started");
    Ok(())
}
