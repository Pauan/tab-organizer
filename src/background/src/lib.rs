#![feature(vec_remove_item, option_unwrap_none)]
#![warn(unreachable_pub)]

use wasm_bindgen::prelude::*;
use std::rc::Rc;
use std::cell::{Cell, RefCell};
use std::collections::HashMap;
use std::future::Future;
use uuid::Uuid;
use futures::{try_join, FutureExt};
use futures::future::try_join_all;
use futures::stream::{Stream, StreamExt, TryStreamExt};
use wasm_bindgen::intern;
use wasm_bindgen_futures::JsFuture;
use js_sys::Date;
use dominator::clone;
use tab_organizer::{spawn, log, info, object, serialize, deserialize_str, serialize_str, Listener, Database, on_connect, Port, panic_hook, set_print_logs};
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

    /// This finds the nearest browser tab to the right of the new tab
    fn new_tab_index(&self, new_index: usize) -> usize {
        if let Some(new_uuid) = self.tabs.get(new_index) {
            self.serialized.tab_index(*new_uuid)

        } else {
            // TODO is this correct ?
            self.serialized.tabs.len()
        }
    }

    // TODO maybe the movement should take into account whether it's moving left or right ?
    fn insert_tab(&mut self, tab_uuid: Uuid, new_index: u32) -> usize {
        let new_index = new_index as usize;

        let tab_index = self.new_tab_index(new_index);

        self.tabs.insert(new_index, tab_uuid);

        tab_index
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

    fn tab_uuid(&self, tab_id: Id) -> impl Future<Output = Result<Option<Uuid>, JsValue>> {
        self.browser.get_tab_uuid(tab_id)
    }

    fn tabs(&self, tabs: Vec<browser::TabState>) -> impl Future<Output = Result<Vec<(Uuid, browser::TabState)>, JsValue>> {
        let tabs = {
            try_join_all(tabs
                .into_iter()
                .map(|tab| {
                    let uuid = self.tab_uuid(tab.id);

                    async fn map<A>(uuid: A, tab: browser::TabState) -> Result<Option<(Uuid, browser::TabState)>, JsValue>
                        where A: Future<Output = Result<Option<Uuid>, JsValue>> {

                        if let Some(uuid) = uuid.await? {
                            Ok(Some((uuid, tab)))

                        } else {
                            Ok(None)
                        }
                    }

                    map(uuid, tab)
                }))
        };

        async move {
            // Filters out None
            Ok(tabs.await?.into_iter().filter_map(|x| x).collect())
        }
    }

    fn window_uuid(&self, window_id: Id, tabs: Vec<browser::TabState>) -> impl Future<Output = Result<Option<(Uuid, Vec<(Uuid, browser::TabState)>)>, JsValue>> {
        let uuid = self.browser.get_window_uuid(window_id);
        let tabs = Self::tabs(self, tabs);

        // TODO remove this boxed
        async move {
            let (uuid, tabs) = try_join!(uuid, tabs)?;

            if let Some(uuid) = uuid {
                Ok(Some((uuid, tabs)))

            } else {
                Ok(None)
            }
        }.boxed_local()
    }

    fn new_tab(&mut self, timestamp_created: f64, uuid: Uuid, tab: &browser::TabState) -> TabCreated {
        let key = SerializedTab::key(uuid);

        let mut is_new = false;

        let mut serialized = self.db.get_or_insert(&key, || {
            is_new = true;
            SerializedTab::new(uuid, timestamp_created)
        });

        // TODO send ServerMessage::TabFocused ?
        let changed = serialized.initialize(&tab, timestamp_created);
        let mut changes = serialized.update(&tab);

        if changed || !changes.is_empty() {
            self.db.set(&key, &serialized);
        }

        let mut browser_tab = BrowserTab::new(serialized, tab.id);

        changes.append(&mut browser_tab.update(&tab));

        if self.ids.contains_key(&uuid) {
            log!("Uuid already exists {}", uuid);
        }

        self.ids.insert(uuid, tab.id).unwrap_none();
        self.tab_ids.insert(tab.id, browser_tab).unwrap_none();

        TabCreated {
            uuid,
            focused: tab.focused,
            is_new,
            changes,
        }
    }

    fn new_window(&mut self, timestamp_created: f64, uuid: Uuid, id: Id, focused: bool, tabs: &[(Uuid, browser::TabState)]) -> Uuid {
        let mut focused_tab = None;

        let tabs: Vec<Uuid> = tabs.into_iter().map(|(uuid, tab)| {
            let info = self.new_tab(timestamp_created, *uuid, tab);

            if info.focused {
                assert_eq!(focused_tab, None);
                focused_tab = Some(info.uuid);
            }

            info.uuid
        }).collect();

        let key = SerializedWindow::key(uuid);

        let mut serialized = self.db.get_or_insert(&key, || SerializedWindow::new(uuid, timestamp_created));

        let changed = merge_ids(&mut serialized.tabs, &tabs);

        if changed {
            self.db.set(&key, &serialized);
        }

        // TODO is this needed ?
        self.ids.insert(uuid, id).unwrap_none();

        self.window_ids.insert(id, BrowserWindow {
            serialized,
            window_id: id,
            tabs,
            focused_tab,
            is_unloading: false,
            ports: vec![],
        }).unwrap_none();

        if focused {
            self.focused_window = Some(uuid);
        }

        // This uses spawn so it doesn't block the rest of the messages
        spawn(self.browser.set_sidebar(id, &format!("sidebar.html?{}", serialize_str(&id))));

        uuid
    }

    fn initialize(state: Rc<RefCell<Self>>, timestamp_created: f64, windows: Vec<browser::WindowState>) -> impl Future<Output = Result<(), JsValue>> {
        let window_uuids = {
            let state = state.borrow();

            try_join_all(windows
                .into_iter()
                .map(|window| {
                    let uuid = state.window_uuid(window.id, window.tabs);

                    async fn map<A>(uuid: A, id: Id, focused: bool) -> Result<Option<(Uuid, Id, bool, Vec<(Uuid, browser::TabState)>)>, JsValue>
                        where A: Future<Output = Result<Option<(Uuid, Vec<(Uuid, browser::TabState)>)>, JsValue>> {

                        if let Some((uuid, tabs)) = uuid.await? {
                            Ok(Some((uuid, id, focused, tabs)))

                        } else {
                            Ok(None)
                        }
                    }

                    map(uuid, window.id, window.focused)
                }))
        };

        // TODO remove this boxed
        async move {
            let window_uuids = window_uuids.await?;

            let mut state = state.borrow_mut();

            let new_windows: Vec<Uuid> = window_uuids
                .into_iter()
                // Filters out None
                .filter_map(|x| {
                    if let Some((uuid, id, focused, tabs)) = x {
                        state.new_window(timestamp_created, uuid, id, focused, &tabs);
                        Some(uuid)

                    } else {
                        None
                    }
                })
                .collect();

            let mut window_ids: Vec<Uuid> = state.db.get_or_insert(intern("windows"), || vec![]);

            let changed = merge_ids(&mut window_ids, &new_windows);

            if changed {
                state.db.set(intern("windows"), &window_ids);
            }

            Ok(())
        }.boxed_local()
    }
}


#[wasm_bindgen(start)]
pub async fn main_js() -> Result<(), JsValue> {
    std::panic::set_hook(Box::new(panic_hook));
    set_print_logs();


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
    State::initialize(state.clone(), timestamp_created, browser_windows.await?).await?;


    fn listen_to_sidebar(state: Rc<RefCell<State>>, sidebar_messages: impl Stream<Item = Port<sidebar::ServerMessage, sidebar::ClientMessage>> + 'static) {
        async fn on_message(
            port_id: Rc<Cell<Option<Id>>>,
            state: Rc<RefCell<State>>,
            port: Rc<Port<sidebar::ServerMessage, sidebar::ClientMessage>>,
            message: sidebar::ClientMessage,
        ) -> Result<(), JsValue> {

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

                sidebar::ClientMessage::MuteTabs { uuids, muted } => {
                    let state: &mut State = &mut state.borrow_mut();

                    let fut = try_join_all(uuids.into_iter().filter_map(|uuid| {
                        match state.ids.get(&uuid) {
                            Some(id) => {
                                state.browser.get_tab_real_id(*id).map(|id| {
                                    let fut = web_extension::browser.tabs().update(Some(id), &object! {
                                        "muted": muted,
                                    });

                                    async move {
                                        let _ = JsFuture::from(fut).await?;
                                        Ok(()) as Result<(), JsValue>
                                    }
                                })
                            },

                            // Tab is unloaded
                            None => None,
                        }
                    }));

                    spawn(async move {
                        let _ = fut.await?;
                        Ok(())
                    });
                },
            }

            Ok(())
        }

        spawn(sidebar_messages
            .map(|x| -> Result<_, JsValue> { Ok(x) })
            .try_for_each_concurrent(None, move |port| {
                let port = Rc::new(port);

                // TODO remove this boxed
                clone!(state => async move {
                    let port_id = Rc::new(Cell::new(None));

                    port.on_message()
                        .map(|x| -> Result<_, JsValue> { Ok(x) })
                        .try_for_each(clone!(port_id, state, port => move |message| {
                            on_message(port_id.clone(), state.clone(), port.clone(), message)
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
                }.boxed_local())
            }));
    }


    fn listen_to_options(state: Rc<RefCell<State>>, options_messages: impl Stream<Item = Port<options::ServerMessage, options::ClientMessage>> + 'static) {
        async fn on_message(state: Rc<RefCell<State>>, port: Rc<Port<options::ServerMessage, options::ClientMessage>>, message: options::ClientMessage) -> Result<(), JsValue> {
            match message {
                options::ClientMessage::Initialize => {
                    port.send_message(&options::ServerMessage::Initial);
                },
            }

            Ok(())
        }

        spawn(options_messages
            .map(|x| -> Result<_, JsValue> { Ok(x) })
            .try_for_each_concurrent(None, move |port| {
                let port = Rc::new(port);

                // TODO remove this boxed
                clone!(state => async move {
                    state.borrow_mut().options_ports.push(port.clone());

                    port.on_message()
                        .map(|x| -> Result<_, JsValue> { Ok(x) })
                        .try_for_each(clone!(state, port => move |message| {
                            on_message(state.clone(), port.clone(), message)
                        })).await?;

                    {
                        let mut state = state.borrow_mut();
                        let index = state.options_ports.iter().position(|x| Rc::ptr_eq(x, &port)).unwrap();
                        state.options_ports.remove(index);
                    }

                    Ok(())
                }.boxed_local())
            }));
    }


    fn listen_to_changes(state: Rc<RefCell<State>>, browser_changes: impl Stream<Item = BrowserChange> + 'static) {
        async fn on_change(state: Rc<RefCell<State>>, change: BrowserChange) -> Result<(), JsValue> {
            info!("{:#?}", change);

            match change {
                BrowserChange::WindowCreated { timestamp, window } => {
                    let uuid = state.borrow().window_uuid(window.id, window.tabs);

                    if let Some((uuid, tabs)) = uuid.await? {
                        let mut state = state.borrow_mut();

                        let uuid = state.new_window(timestamp, uuid, window.id, window.focused, &tabs);

                        let mut window_ids: Vec<Uuid> = state.db.get_or_insert(intern("windows"), || vec![]);

                        // TODO insert at the proper index ?
                        window_ids.push(uuid);

                        state.db.set(intern("windows"), &window_ids);
                    }
                },

                // TODO call browser.sidebar_action().set_panel ?
                BrowserChange::WindowRemoved { timestamp: _, window_id } => {
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

                BrowserChange::WindowFocused { timestamp: _, window_id } => {
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

                // TODO verify this works correctly if the tab is already focused
                BrowserChange::TabCreated { timestamp, tab, window_id, index } => {
                    let uuid = state.borrow().tab_uuid(tab.id);

                    if let Some(uuid) = uuid.await? {
                        let state: &mut State = &mut state.borrow_mut();

                        // TODO is this correct ?
                        if state.window_ids.contains_key(&window_id) {
                            let info = state.new_tab(timestamp, uuid, &tab);

                            let browser_window = state.window_ids.get_mut(&window_id).unwrap();
                            let browser_tab = state.tab_ids.get(&tab.id).unwrap();

                            if info.is_new {
                                let tab_index = browser_window.insert_tab(info.uuid, index);

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

                                let new_tab_index = browser_window.insert_tab(info.uuid, index);

                                browser_window.serialized.tabs.insert(new_tab_index, info.uuid);

                                if old_tab_index != new_tab_index {
                                    browser_window.serialize(&state.db);
                                    browser_window.send_message(&sidebar::ServerMessage::TabMoved { old_tab_index, new_tab_index });
                                }
                            }
                        }
                    }
                },

                BrowserChange::TabUpdated { timestamp: _, window_id, tab } => {
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
                BrowserChange::TabFocused { timestamp, tab_id, window_id } => {
                    let state: &mut State = &mut state.borrow_mut();

                    if let Some(browser_tab) = state.tab_ids.get_mut(&tab_id) {
                        let browser_window = state.window_ids.get_mut(&window_id).unwrap();

                        let uuid = browser_tab.serialized.uuid;

                        // TODO maybe it should still focus it even if this is None ?
                        if let Some(old_tab_uuid) = browser_window.set_focused(uuid) {
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
                    }
                },

                BrowserChange::TabAttached { timestamp: _, tab_id, old_window_id, old_index, new_window_id, new_index } => {
                    let state: &mut State = &mut state.borrow_mut();

                    if let Some(browser_tab) = state.tab_ids.get(&tab_id) {
                        let tab_uuid = browser_tab.serialized.uuid;

                        // TODO what if this is None ?
                        // TODO verify this works correctly if the tab is focused
                        if let Some(old_window) = state.window_ids.get_mut(&old_window_id) {
                            assert_eq!(old_window.tabs.remove(old_index as usize), tab_uuid);

                            old_window.unfocus_tab(tab_uuid);

                            let tab_index = old_window.serialized.tab_index(tab_uuid);

                            assert_eq!(old_window.serialized.tabs.remove(tab_index), tab_uuid);

                            old_window.serialize(&state.db);

                            old_window.send_message(&sidebar::ServerMessage::TabRemoved { tab_index });
                        }

                        // TODO what if this is None ?
                        // TODO verify this works correctly if the tab is focused
                        if let Some(new_window) = state.window_ids.get_mut(&new_window_id) {
                            let tab_index = new_window.insert_tab(tab_uuid, new_index);

                            new_window.serialized.tabs.insert(tab_index, tab_uuid);
                            new_window.serialize(&state.db);

                            new_window.send_message(&sidebar::ServerMessage::TabInserted {
                                tab_index,
                                tab: browser_tab.to_tab(&new_window),
                            });
                        }
                    }
                },

                BrowserChange::TabMoved { timestamp: _, tab_id, window_id, old_index, new_index } => {
                    let state: &mut State = &mut state.borrow_mut();

                    if let Some(browser_tab) = state.tab_ids.get(&tab_id) {
                        let browser_window = state.window_ids.get_mut(&window_id).unwrap();

                        let tab_uuid = browser_tab.serialized.uuid;

                        assert_eq!(browser_window.tabs.remove(old_index as usize), tab_uuid);


                        let old_tab_index = browser_window.serialized.tab_index(tab_uuid);

                        assert_eq!(browser_window.serialized.tabs.remove(old_tab_index), tab_uuid);


                        let new_tab_index = browser_window.insert_tab(tab_uuid, new_index);

                        browser_window.serialized.tabs.insert(new_tab_index, tab_uuid);


                        browser_window.serialize(&state.db);

                        browser_window.send_message(&sidebar::ServerMessage::TabMoved { old_tab_index, new_tab_index });
                    }
                },

                // TODO verify this works correctly if the tab is focused
                BrowserChange::TabRemoved { timestamp: _, tab_id, window_id, is_window_closing } => {
                    let state: &mut State = &mut state.borrow_mut();

                    if let Some(mut browser_tab) = state.tab_ids.remove(&tab_id) {
                        if is_window_closing {
                            state.db.delay_commit();
                        }

                        let tab_uuid = browser_tab.serialized.uuid;

                        assert_eq!(state.ids.remove(&tab_uuid).unwrap(), tab_id);

                        let browser_window = state.window_ids.get_mut(&window_id).unwrap();

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
        }

        spawn(browser_changes
            .map(|x| -> Result<BrowserChange, JsValue> { Ok(x) })
            .try_for_each(move |change| {
                on_change(state.clone(), change)
            }));
    }


    listen_to_sidebar(state.clone(), sidebar_messages);
    listen_to_options(state.clone(), options_messages);
    listen_to_changes(state, browser_changes);


    log!("Background page started");
    Ok(())
}
