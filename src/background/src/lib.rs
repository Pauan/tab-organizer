#![feature(vec_remove_item, option_unwrap_none)]
#![warn(unreachable_pub)]
// TODO hacky
#![type_length_limit="1175546"]

use wasm_bindgen::prelude::*;
use std::rc::Rc;
use std::cell::{Cell, RefCell};
use std::collections::HashMap;
use uuid::Uuid;
use futures::try_join;
use futures::future::try_join_all;
use futures::stream::{StreamExt, TryStreamExt};
use wasm_bindgen::intern;
use wasm_bindgen_futures::JsFuture;
use js_sys::Date;
use dominator::clone;
use tab_organizer::{spawn, log, info, serialize, deserialize_str, serialize_str, Listener, Database, on_connect, Port, export_function, closure, print_logs};
use tab_organizer::state::{Tab, TabStatus, SerializedWindow, SerializedTab, sidebar, options};
use tab_organizer::browser::{Browser, Id, BrowserChange};
use tab_organizer::browser;

mod migrate;


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
    serialized: SerializedTab,
    tab_id: Id,
    is_unloading: bool,

    // These must be kept in sync with Tab
    playing_audio: bool,
    has_attention: bool,
    status: TabStatus,
}

impl BrowserTab {
    fn new(serialized: SerializedTab, tab_id: Id) -> Self {
        Self {
            serialized,
            tab_id,
            is_unloading: false,

            // This must be kept in sync with Tab::unloaded
            playing_audio: false,
            has_attention: false,
            status: TabStatus::Unloaded,
        }
    }

    fn update(&mut self, tab: &browser::TabState) -> Vec<sidebar::TabChange> {
        let mut changes = vec![];

        if self.playing_audio != tab.audio.playing {
            self.playing_audio = tab.audio.playing;
            changes.push(sidebar::TabChange::PlayingAudio { playing: self.playing_audio });
        }

        if self.has_attention != tab.has_attention {
            self.has_attention = tab.has_attention;
            changes.push(sidebar::TabChange::HasAttention { has: self.has_attention });
        }

        if self.status != tab.status {
            self.status = tab.status;
            changes.push(sidebar::TabChange::Status { status: self.status });
        }

        changes
    }

    fn update_unloaded(&mut self) -> Vec<sidebar::TabChange> {
        let mut changes = vec![];

        if self.playing_audio != false {
            self.playing_audio = false;
            changes.push(sidebar::TabChange::PlayingAudio { playing: self.playing_audio });
        }

        if self.has_attention != false {
            self.has_attention = false;
            changes.push(sidebar::TabChange::HasAttention { has: self.has_attention });
        }

        if self.status != TabStatus::Unloaded {
            self.status = TabStatus::Unloaded;
            changes.push(sidebar::TabChange::Status { status: self.status });
        }

        changes
    }

    fn to_tab(&self, window: &BrowserWindow) -> Tab {
        Tab {
            // TODO avoid this clone somehow ?
            serialized: self.serialized.clone(),
            focused: window.is_tab_focused(self.serialized.uuid),
            playing_audio: self.playing_audio,
            has_attention: self.has_attention,
            status: self.status,
        }
    }
}


#[derive(Debug)]
struct BrowserWindow {
    serialized: SerializedWindow,
    window_id: Id,
    tabs: Vec<Uuid>,
    focused_tab: Option<Uuid>,
    is_unloading: bool,
    ports: Vec<Rc<Port<sidebar::ServerMessage, sidebar::ClientMessage>>>,
}

impl BrowserWindow {
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

        Some(old_tab_uuid)
    }

    fn unfocus_tab(&mut self, tab_id: Uuid) -> bool {
        if let Some(old_uuid) = self.focused_tab {
            if old_uuid == tab_id {
                self.focused_tab = None;
                true

            } else {
                false
            }

        } else {
            false
        }
    }

    fn send_message(&self, message: &sidebar::ServerMessage) {
        if !self.ports.is_empty() {
            let message = serialize(&message);

            for port in self.ports.iter() {
                port.unchecked_send_message(&message);
            }
        }
    }

    fn serialize(&self, db: &Database) {
        db.set(&SerializedWindow::key(self.serialized.uuid), &self.serialized);
    }
}


struct TabCreated {
    uuid: Uuid,
    focused: bool,
    is_new: bool,
    changes: Vec<sidebar::TabChange>,
}


struct State {
    db: Database,
    browser: Browser,

    ids: HashMap<Uuid, Id>,
    tab_ids: HashMap<Id, BrowserTab>,
    window_ids: HashMap<Id, BrowserWindow>,

    focused_window: Option<Uuid>,

    options_ports: Vec<Rc<Port<options::ServerMessage, options::ClientMessage>>>,
}

impl State {
    fn new(db: Database) -> Rc<RefCell<Self>> {
        Rc::new(RefCell::new(Self {
            db,
            browser: Browser::new(),

            ids: HashMap::new(),
            tab_ids: HashMap::new(),
            window_ids: HashMap::new(),

            focused_window: None,

            options_ports: vec![],
        }))
    }

    async fn new_tab(state: &Rc<RefCell<Self>>, timestamp_created: f64, tab: &browser::TabState) -> Result<Option<TabCreated>, JsValue> {
        let uuid = state.borrow().browser.get_tab_uuid(tab.id);

        if let Some(uuid) = uuid {
            let uuid = uuid.await?;

            if let Some(uuid) = uuid {
                let state: &mut State = &mut state.borrow_mut();

                let key = SerializedTab::key(uuid);

                let mut is_new = false;

                let mut serialized = state.db.get_or_insert(&key, || {
                    is_new = true;
                    SerializedTab::new(uuid, timestamp_created)
                });

                // TODO send ServerMessage::TabFocused ?
                let changed = serialized.initialize(&tab, timestamp_created);
                let mut changes = serialized.update(&tab);

                if changed || !changes.is_empty() {
                    state.db.set(&key, &serialized);
                }

                state.ids.insert(uuid, tab.id).unwrap_none();

                let mut browser_tab = BrowserTab::new(serialized, tab.id);

                changes.append(&mut browser_tab.update(&tab));

                state.tab_ids.insert(tab.id, browser_tab).unwrap_none();

                Ok(Some(TabCreated {
                    uuid,
                    focused: tab.focused,
                    is_new,
                    changes,
                }))

            } else {
                Ok(None)
            }

        } else {
            Ok(None)
        }
    }

    async fn tabs(state: &Rc<RefCell<Self>>, timestamp_created: f64, tabs: &[browser::TabState]) -> Result<Vec<TabCreated>, JsValue> {
        let tabs = try_join_all(tabs
            .into_iter()
            .map(|tab| State::new_tab(state, timestamp_created, tab))).await?;

        // Filter out None
        Ok(tabs.into_iter().filter_map(|x| x).collect())
    }

    async fn new_window(state: &Rc<RefCell<Self>>, timestamp_created: f64, window: &browser::WindowState) -> Result<Option<Uuid>, JsValue> {
        let uuid = state.borrow().browser.get_window_uuid(window.id);

        if let Some(uuid) = uuid {
            let (uuid, tabs) = try_join!(
                uuid,
                Self::tabs(state, timestamp_created, &window.tabs),
            )?;

            if let Some(uuid) = uuid {
                let state: &mut State = &mut state.borrow_mut();

                let mut focused_tab = None;

                let tabs: Vec<Uuid> = tabs.into_iter().map(|info| {
                    if info.focused {
                        assert_eq!(focused_tab, None);
                        focused_tab = Some(info.uuid);
                    }

                    info.uuid
                }).collect();

                let key = SerializedWindow::key(uuid);

                let mut serialized = state.db.get_or_insert(&key, || SerializedWindow::new(uuid, timestamp_created));

                let changed = merge_ids(&mut serialized.tabs, &tabs);

                if changed {
                    state.db.set(&key, &serialized);
                }

                // TODO is this needed ?
                state.ids.insert(uuid, window.id).unwrap_none();

                state.window_ids.insert(window.id, BrowserWindow {
                    serialized,
                    window_id: window.id,
                    tabs,
                    focused_tab,
                    is_unloading: false,
                    ports: vec![],
                }).unwrap_none();

                if window.focused {
                    state.focused_window = Some(uuid);
                }

                // This uses spawn so it doesn't block the rest of the messages
                spawn(state.browser.set_sidebar(window.id, &format!("sidebar.html?{}", serialize_str(&window.id))));

                Ok(Some(uuid))

            } else {
                Ok(None)
            }

        } else {
            Ok(None)
        }
    }

    async fn initialize(state: &Rc<RefCell<Self>>, timestamp_created: f64, windows: &[browser::WindowState]) -> Result<(), JsValue> {
        let new_windows = try_join_all(windows
            .into_iter()
            .map(|x| Self::new_window(state, timestamp_created, x))).await?;

        // Filter out None
        let new_windows: Vec<Uuid> = new_windows.into_iter().filter_map(|x| x).collect();

        let state = state.borrow();

        let mut window_ids: Vec<Uuid> = state.db.get_or_insert(intern("windows"), || vec![]);

        let changed = merge_ids(&mut window_ids, &new_windows);

        if changed {
            state.db.set(intern("windows"), &window_ids);
        }

        Ok(())
    }

    /// This finds the nearest browser tab to the right of the new tab
    fn new_tab_index(browser_window: &BrowserWindow, new_index: usize) -> usize {
        if let Some(new_uuid) = browser_window.tabs.get(new_index) {
            browser_window.serialized.tab_index(*new_uuid)

        } else {
            // TODO is this correct ?
            browser_window.serialized.tabs.len()
        }
    }

    // TODO maybe the movement should take into account whether it's moving left or right ?
    fn insert_tab(browser_window: &mut BrowserWindow, tab_uuid: Uuid, new_index: u32) -> usize {
        let new_index = new_index as usize;

        let tab_index = Self::new_tab_index(browser_window, new_index);

        browser_window.tabs.insert(new_index, tab_uuid);

        tab_index
    }
}


#[wasm_bindgen(start)]
pub async fn main_js() -> Result<(), JsValue> {
    console_error_panic_hook::set_once();


    log!("Starting");


    Listener::new(web_extension::browser.browser_action().on_clicked(), Closure::wrap(Box::new(move |_: JsValue| {
        let fut = web_extension::browser.sidebar_action().open();

        spawn(async move {
            let _ = JsFuture::from(fut).await?;
            Ok(())
        });
    }) as Box<dyn FnMut(JsValue)>)).forget();


    let sidebar_messages = on_connect::<sidebar::ServerMessage, sidebar::ClientMessage>("sidebar");
    let options_messages = on_connect::<options::ServerMessage, options::ClientMessage>("options");


    export_function("print_logs", closure!(move |amount: usize| {
        print_logs(amount);
    }));


    log!("Starting database");

    let db = Database::new().await?;

    db.clear();

    migrate::migrate(&db);

    let state = State::new(db);

    // TODO only have a single borrow somehow
    let browser_windows = state.borrow().browser.current();
    let browser_changes = state.borrow().browser.changes();

    log!("Initializing state");

    let timestamp_created = Date::now();
    State::initialize(&state, timestamp_created, &browser_windows.await?).await?;


    spawn(clone!(state => async move {
        sidebar_messages
            .map(|x| -> Result<_, JsValue> { Ok(x) })
            .try_for_each_concurrent(None, move |port| {
                let port = Rc::new(port);

                clone!(state => async move {
                    let port_id = Rc::new(Cell::new(None));

                    port.on_message()
                        .map(|x| -> Result<_, JsValue> { Ok(x) })
                        .try_for_each(clone!(port_id, state, port => move |message| {
                            clone!(port_id, state, port => async move {
                                fn remove_tabs(ids: js_sys::Array) {
                                    if ids.length() > 0 {
                                        // TODO immediately send out a message to the sidebar ?
                                        let fut = web_extension::browser.tabs().remove(&ids);

                                        // TODO should this spawn ?
                                        spawn(async {
                                            JsFuture::from(fut).await?;
                                            Ok(())
                                        });
                                    }
                                }

                                match message {
                                    sidebar::ClientMessage::Initialize { id } => {
                                        let id: Id = deserialize_str(&id);

                                        let state: &mut State = &mut state.borrow_mut();

                                        if let Some(window) = state.window_ids.get_mut(&id) {
                                            port_id.set(Some(id));
                                            window.ports.push(port.clone());

                                            let db = &state.db;
                                            let ids = &state.ids;
                                            let tab_ids = &state.tab_ids;

                                            // TODO figure out a way to avoid this clone
                                            let tabs: Vec<Tab> = window.serialized.tabs.iter()
                                                .map(|uuid| {
                                                    match ids.get(&uuid) {
                                                        Some(id) => {
                                                            let browser_tab = tab_ids.get(&id).unwrap();
                                                            browser_tab.to_tab(&window)
                                                        },

                                                        // Tab is unloaded
                                                        None => {
                                                            let key = SerializedTab::key(*uuid);
                                                            let serialized: SerializedTab = db.get(&key).unwrap();
                                                            Tab::unloaded(serialized)
                                                        },
                                                    }
                                                })
                                                .collect();

                                            port.send_message(&sidebar::ServerMessage::Initial { tabs });
                                        }
                                    },

                                    sidebar::ClientMessage::ClickTab { uuid } => {
                                        let state = state.borrow();

                                        match state.ids.get(&uuid) {
                                            Some(id) => {
                                                state.browser.get_tab(*id, move |tab| {
                                                    if let Some(tab) = tab {
                                                        spawn(tab.focus());
                                                    }
                                                });
                                            },

                                            // Tab is unloaded
                                            None => {

                                            },
                                        }
                                    },

                                    sidebar::ClientMessage::CloseTabs { uuids } => {
                                        let state: &mut State = &mut state.borrow_mut();

                                        let mut close_unloaded = vec![];

                                        let ids = uuids.into_iter().filter_map(|uuid| {
                                            match state.ids.get(&uuid) {
                                                Some(id) => {
                                                    // TODO can this be made faster ?
                                                    state.browser.get_tab_real_id(*id).map(JsValue::from)
                                                },

                                                // Tab is unloaded
                                                None => {
                                                    close_unloaded.push(uuid);
                                                    None
                                                },
                                            }
                                        }).collect::<js_sys::Array>();

                                        remove_tabs(ids);

                                        if !close_unloaded.is_empty() {
                                            let window_ids = &mut state.window_ids;

                                            if let Some(window) = port_id.get().and_then(|window_id| window_ids.get_mut(&window_id)) {
                                                let db = &state.db;

                                                let tab_indexes = close_unloaded.into_iter().map(|uuid| {
                                                    let tab_index = window.serialized.tab_index(uuid);

                                                    window.serialized.tabs.remove(tab_index);

                                                    // TODO verify that the key already existed
                                                    db.remove(&SerializedTab::key(uuid));

                                                    tab_index
                                                }).collect::<Vec<usize>>();

                                                window.serialize(&state.db);

                                                for tab_index in tab_indexes {
                                                    window.send_message(&sidebar::ServerMessage::TabRemoved { tab_index });
                                                }
                                            }
                                        }
                                    },

                                    sidebar::ClientMessage::UnloadTabs { uuids } => {
                                        let state: &mut State = &mut state.borrow_mut();

                                        let ids = uuids.into_iter().filter_map(|uuid| {
                                            match state.ids.get(&uuid) {
                                                Some(id) => {
                                                    let tab = state.tab_ids.get_mut(&id).unwrap();

                                                    if tab.is_unloading {
                                                        None

                                                    } else {
                                                        tab.is_unloading = true;

                                                        // TODO can this be made faster ?
                                                        state.browser.get_tab_real_id(*id).map(JsValue::from)
                                                    }
                                                },

                                                // Tab is unloaded
                                                None => None,
                                            }
                                        }).collect::<js_sys::Array>();

                                        remove_tabs(ids);
                                    },
                                }

                                Ok(()) as Result<(), JsValue>
                            })
                        })).await?;

                    info!("Port stopped {:?}", port_id);

                    if let Some(id) = port_id.get() {
                        let mut state = state.borrow_mut();

                        if let Some(window) = state.window_ids.get_mut(&id) {
                            let index = window.ports.iter().position(|x| Rc::ptr_eq(x, &port)).unwrap();
                            window.ports.remove(index);
                        }
                    }

                    Ok(())
                })
            }).await
    }));


    spawn(clone!(state => async move {
        options_messages
            .map(|x| -> Result<_, JsValue> { Ok(x) })
            .try_for_each_concurrent(None, move |port| {
                let port = Rc::new(port);

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

                    {
                        let mut state = state.borrow_mut();
                        let index = state.options_ports.iter().position(|x| Rc::ptr_eq(x, &port)).unwrap();
                        state.options_ports.remove(index);
                    }

                    Ok(())
                })
            }).await
    }));


    spawn(async move {
        browser_changes
            .map(|x| -> Result<BrowserChange, JsValue> { Ok(x) })
            .try_for_each(move |change| {
                clone!(state => async move {
                    info!("{:#?}", change);

                    match change {
                        BrowserChange::WindowCreated { timestamp, window } => {
                            if let Some(uuid) = State::new_window(&state, timestamp, &window).await? {
                                let state = state.borrow();

                                let mut window_ids: Vec<Uuid> = state.db.get_or_insert(intern("windows"), || vec![]);

                                // TODO insert at the proper index ?
                                window_ids.push(uuid);

                                state.db.set(intern("windows"), &window_ids);
                            }
                        },

                        // TODO call browser.sidebar_action().set_panel ?
                        BrowserChange::WindowRemoved { window_id } => {
                            let mut state = state.borrow_mut();

                            if let Some(browser_window) = state.window_ids.remove(&window_id) {
                                state.db.delay_commit();

                                let uuid = browser_window.serialized.uuid;

                                assert_eq!(state.ids.remove(&uuid).unwrap(), window_id);

                                assert_eq!(browser_window.tabs.len(), 0);

                                if let Some(focused_uuid) = state.focused_window {
                                    if focused_uuid == uuid {
                                        state.focused_window = None;
                                    }
                                }

                                if !browser_window.is_unloading {
                                    // These are only unloaded tabs
                                    for uuid in browser_window.serialized.tabs {
                                        // TODO verify that the key already existed
                                        state.db.remove(&SerializedTab::key(uuid));
                                    }

                                    state.db.remove(&SerializedWindow::key(uuid));

                                    let mut window_ids: Vec<Uuid> = state.db.get_or_insert(intern("windows"), || vec![]);

                                    window_ids.remove_item(&uuid).unwrap();

                                    state.db.set(intern("windows"), &window_ids);
                                }
                            }
                        },

                        BrowserChange::WindowFocused { window_id } => {
                            let state: &mut State = &mut state.borrow_mut();

                            if let Some(window_id) = window_id {
                                if let Some(browser_window) = state.window_ids.get(&window_id) {
                                    state.focused_window = Some(browser_window.serialized.uuid);

                                } else {
                                    state.focused_window = None;
                                }

                            } else {
                                state.focused_window = None;
                            }
                        },

                        BrowserChange::TabCreated { timestamp, tab, window_id, index } => {
                            if let Some(info) = State::new_tab(&state, timestamp, &tab).await? {
                                assert_eq!(info.focused, false);

                                let state: &mut State = &mut state.borrow_mut();

                                // TODO what if this is None ?
                                let browser_window = state.window_ids.get_mut(&window_id).unwrap();
                                let browser_tab = state.tab_ids.get(&tab.id).unwrap();

                                if info.is_new {
                                    let tab_index = State::insert_tab(browser_window, info.uuid, index);

                                    browser_window.serialized.tabs.insert(tab_index, info.uuid);
                                    browser_window.serialize(&state.db);

                                    browser_window.send_message(&sidebar::ServerMessage::TabInserted {
                                        tab_index,
                                        tab: browser_tab.to_tab(&browser_window),
                                    });

                                // Tab was unloaded
                                } else {
                                    let old_tab_index = browser_window.serialized.tab_index(info.uuid);

                                    browser_window.send_message(&sidebar::ServerMessage::TabChanged { tab_index: old_tab_index, changes: info.changes });

                                    browser_window.serialized.tabs.remove(old_tab_index);

                                    let new_tab_index = State::insert_tab(browser_window, info.uuid, index);

                                    browser_window.serialized.tabs.insert(new_tab_index, info.uuid);

                                    if old_tab_index != new_tab_index {
                                        browser_window.serialize(&state.db);
                                        browser_window.send_message(&sidebar::ServerMessage::TabMoved { old_tab_index, new_tab_index });
                                    }
                                }
                            }
                        },

                        BrowserChange::TabUpdated { window_id, tab } => {
                            let state: &mut State = &mut state.borrow_mut();

                            if let Some(browser_tab) = state.tab_ids.get_mut(&tab.id) {
                                let browser_window = state.window_ids.get(&window_id).unwrap();

                                let tab_uuid = browser_tab.serialized.uuid;

                                let mut serialized_changes = browser_tab.serialized.update(&tab);

                                if !serialized_changes.is_empty() {
                                    state.db.set(&SerializedTab::key(tab_uuid), &browser_tab.serialized);
                                }

                                serialized_changes.append(&mut browser_tab.update(&tab));

                                if !serialized_changes.is_empty() {
                                    let tab_index = browser_window.serialized.tab_index(tab_uuid);

                                    browser_window.send_message(&sidebar::ServerMessage::TabChanged { tab_index, changes: serialized_changes });
                                }
                            }
                        },

                        // TODO put in asserts that the old_tab_id matches ?
                        BrowserChange::TabFocused { timestamp, old_tab_id: _, new_tab_id, window_id } => {
                            let state: &mut State = &mut state.borrow_mut();

                            if let Some(browser_tab) = state.tab_ids.get_mut(&new_tab_id) {
                                let browser_window = state.window_ids.get_mut(&window_id).unwrap();

                                let uuid = browser_tab.serialized.uuid;

                                let old_tab_uuid = browser_window.set_focused(uuid).unwrap();

                                browser_tab.serialized.timestamp_focused = Some(timestamp);

                                state.db.set(&SerializedTab::key(uuid), &browser_tab.serialized);

                                if let Some(old_tab_uuid) = old_tab_uuid {
                                    let old_tab_index = browser_window.serialized.tab_index(old_tab_uuid);

                                    browser_window.send_message(&sidebar::ServerMessage::TabChanged {
                                        tab_index: old_tab_index,
                                        changes: vec![
                                            sidebar::TabChange::Unfocused,
                                        ],
                                    });
                                }

                                let new_tab_index = browser_window.serialized.tab_index(uuid);

                                browser_window.send_message(&sidebar::ServerMessage::TabChanged {
                                    tab_index: new_tab_index,
                                    changes: vec![
                                        sidebar::TabChange::Focused {
                                            new_timestamp_focused: timestamp,
                                        },
                                    ],
                                });
                            }
                        },

                        BrowserChange::TabAttached { tab_id, old_window_id, old_index, new_window_id, new_index } => {
                            let state: &mut State = &mut state.borrow_mut();

                            if let Some(browser_tab) = state.tab_ids.get(&tab_id) {
                                let tab_uuid = browser_tab.serialized.uuid;

                                // TODO what if this is None ?
                                let is_tab_focused = if let Some(old_window) = state.window_ids.get_mut(&old_window_id) {
                                    assert_eq!(old_window.tabs.remove(old_index as usize), tab_uuid);

                                    let is_tab_focused = old_window.unfocus_tab(tab_uuid);

                                    let tab_index = old_window.serialized.tab_index(tab_uuid);

                                    assert_eq!(old_window.serialized.tabs.remove(tab_index), tab_uuid);

                                    old_window.serialize(&state.db);

                                    old_window.send_message(&sidebar::ServerMessage::TabRemoved { tab_index });

                                    is_tab_focused

                                } else {
                                    false
                                };

                                // TODO what if this is None ?
                                // TODO handle tab focus
                                if let Some(new_window) = state.window_ids.get_mut(&new_window_id) {
                                    let tab_index = State::insert_tab(new_window, tab_uuid, new_index);

                                    new_window.serialized.tabs.insert(tab_index, tab_uuid);
                                    new_window.serialize(&state.db);

                                    new_window.send_message(&sidebar::ServerMessage::TabInserted {
                                        tab_index,
                                        tab: browser_tab.to_tab(&new_window),
                                    });
                                }
                            }
                        },

                        BrowserChange::TabMoved { tab_id, window_id, old_index, new_index } => {
                            let state: &mut State = &mut state.borrow_mut();

                            if let Some(browser_tab) = state.tab_ids.get(&tab_id) {
                                let browser_window = state.window_ids.get_mut(&window_id).unwrap();

                                let tab_uuid = browser_tab.serialized.uuid;

                                assert_eq!(browser_window.tabs.remove(old_index as usize), tab_uuid);


                                let old_tab_index = browser_window.serialized.tab_index(tab_uuid);

                                assert_eq!(browser_window.serialized.tabs.remove(old_tab_index), tab_uuid);


                                let new_tab_index = State::insert_tab(browser_window, tab_uuid, new_index);

                                browser_window.serialized.tabs.insert(new_tab_index, tab_uuid);


                                browser_window.serialize(&state.db);

                                browser_window.send_message(&sidebar::ServerMessage::TabMoved { old_tab_index, new_tab_index });
                            }
                        },

                        BrowserChange::TabRemoved { tab_id, window_id, is_window_closing } => {
                            let state: &mut State = &mut state.borrow_mut();

                            if let Some(mut browser_tab) = state.tab_ids.remove(&tab_id) {
                                if is_window_closing {
                                    state.db.delay_commit();
                                }

                                let browser_window = state.window_ids.get_mut(&window_id).unwrap();

                                let tab_uuid = browser_tab.serialized.uuid;

                                assert_eq!(state.ids.remove(&tab_uuid).unwrap(), tab_id);

                                browser_window.tabs.remove_item(&tab_uuid).unwrap();

                                let is_tab_focused = browser_window.unfocus_tab(tab_uuid);

                                let tab_index = browser_window.serialized.tab_index(tab_uuid);

                                if browser_tab.is_unloading {
                                    // TODO change is_unloading to false when a new tab is created in the window ?
                                    // TODO is this check correct ? maybe it should check the tabs.len() instead
                                    if is_window_closing {
                                        browser_window.is_unloading = true;
                                    }

                                    let mut changes = browser_tab.update_unloaded();

                                    // TODO test this
                                    if is_tab_focused {
                                        changes.push(sidebar::TabChange::Unfocused);
                                    }

                                    if !changes.is_empty() {
                                        browser_window.send_message(&sidebar::ServerMessage::TabChanged { tab_index, changes });
                                    }

                                // TODO maybe if the window is closing then it won't do anything, instead leaving that up to WindowChange::WindowRemoved ?
                                } else {
                                    browser_window.serialized.tabs.remove(tab_index);

                                    // TODO verify that the key existed before ?
                                    state.db.remove(&SerializedTab::key(tab_uuid));
                                    browser_window.serialize(&state.db);

                                    browser_window.send_message(&sidebar::ServerMessage::TabRemoved { tab_index });
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
