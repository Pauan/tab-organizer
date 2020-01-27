use std::rc::Rc;
use std::cell::RefCell;
use std::sync::atomic::{AtomicU32, Ordering};
use std::collections::HashMap;
use serde_derive::{Serialize, Deserialize};
use futures::channel::mpsc;
use futures::stream::Stream;
use futures::{try_join, FutureExt};
use std::future::Future;
use dominator::clone;
use uuid::Uuid;
use js_sys::{Array, Promise, Date};
use wasm_bindgen_futures::JsFuture;
use wasm_bindgen::{JsCast, intern};
use wasm_bindgen::prelude::*;
use web_extension::browser;
use super::{Listener, deserialize, serialize, object, array, generate_uuid, warn};
use super::state::TabStatus;


#[derive(Debug)]
struct Mapping<A> {
    keys: HashMap<i32, Id>,
    values: HashMap<Id, A>,
}

impl<A> Mapping<A> {
    fn new() -> Self {
        Self {
            keys: HashMap::new(),
            values: HashMap::new(),
        }
    }

    fn get_key(&self, key: i32) -> Option<Id> {
        self.keys.get(&key).map(|x| *x)
    }

    fn get_value(&self, id: Id) -> Option<&A> {
        self.values.get(&id)
    }

    fn get_mut(&mut self, key: i32) -> Option<(Id, &mut A)> {
        let id = self.get_key(key)?;
        Some((id, self.values.get_mut(&id).unwrap()))
    }

    fn remove(&mut self, key: i32) -> Option<(Id, A)> {
        let id = self.keys.remove(&key)?;
        let value = self.values.remove(&id).unwrap();
        Some((id, value))
    }

    fn move_key(&mut self, old_key: i32, new_key: i32) -> Option<&mut A> {
        if let Some(id) = self.keys.remove(&old_key) {
            self.keys.insert(new_key, id).unwrap_none();
            Some(self.values.get_mut(&id).unwrap())

        } else {
            None
        }
    }
}

impl<A> Mapping<A> where A: std::fmt::Debug {
    fn insert(&mut self, key: i32, id: Id, value: A) {
        self.keys.insert(key, id).unwrap_none();
        self.values.insert(id, value).unwrap_none();
    }
}


fn get_uuid(fut: Promise) -> impl Future<Output = Result<Option<Uuid>, JsValue>> {
    async move {
        let id = JsFuture::from(fut).await?;

        // TODO better implementation of this ?
        if id.is_undefined() {
            Ok(None)

        } else {
            Ok(Some(deserialize(&id)))
        }
    }
}

fn set_uuid(fut: Promise) -> impl Future<Output = Result<(), JsValue>> {
    async move {
        let value = JsFuture::from(fut).await?;

        assert!(value.is_undefined());

        Ok(())
    }
}


#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[repr(transparent)]
#[serde(transparent)]
pub struct Id(u32);

impl Id {
    fn new() -> Self {
        static COUNTER: AtomicU32 = AtomicU32::new(0);

        // TODO more efficient ordering ?
        Id(COUNTER.fetch_add(1, Ordering::SeqCst))
    }
}


#[derive(Debug)]
pub struct TabAudio {
    pub playing: bool,
    pub muted: bool,
}

impl TabAudio {
    fn new(browser_tab: &web_extension::Tab) -> Self {
        Self {
            playing: browser_tab.audible().unwrap_or(false),
            muted: browser_tab.muted_info().muted(),
        }
    }
}


#[derive(Debug)]
pub struct TabState {
    pub id: Id,
    pub focused: bool,
    pub pinned: bool,
    pub has_attention: bool,
    pub audio: TabAudio,
    pub status: TabStatus,
    pub favicon_url: Option<String>,
    pub title: Option<String>,
    pub url: Option<String>,
}

impl TabState {
    fn status(browser_tab: &web_extension::Tab) -> TabStatus {
        match browser_tab.status().as_deref() {
            None => TabStatus::New,
            Some("loading") => TabStatus::Loading,
            Some("complete") => TabStatus::Complete,
            Some(status) => panic!("Unknown tab status: {}", status),
        }
    }

    fn new(id: Id, browser_tab: &web_extension::Tab) -> Self {
        Self {
            id,
            focused: browser_tab.active(),
            pinned: browser_tab.pinned(),
            has_attention: browser_tab.attention().unwrap_or(false),
            audio: TabAudio::new(browser_tab),
            status: Self::status(browser_tab),
            favicon_url: browser_tab.fav_icon_url(),
            title: browser_tab.title(),
            url: browser_tab.url(),
        }
    }
}


#[derive(Debug)]
pub struct WindowState {
    pub id: Id,
    pub focused: bool,
    pub tabs: Vec<TabState>,
}

impl WindowState {
    fn new(id: Id, tabs: Vec<TabState>, browser_window: &web_extension::Window) -> Self {
        Self {
            id,
            focused: browser_window.focused(),
            tabs
        }
    }
}


#[derive(Debug)]
struct TabDetached {
    index: u32,
    window_id: Id,
}

#[derive(Debug)]
pub struct Tab {
    tab_id: i32,
    window_id: i32,
    detached: Option<TabDetached>,
}

impl Tab {
    fn get_uuid(&self) -> impl Future<Output = Result<Option<Uuid>, JsValue>> {
        get_uuid(browser.sessions().get_tab_value(self.tab_id, intern("id")))
    }

    pub fn set_uuid(&self, uuid: Uuid) -> impl Future<Output = Result<(), JsValue>> {
        set_uuid(browser.sessions().set_tab_value(self.tab_id, intern("id"), &serialize(&uuid)))
    }

    pub fn set_new_uuid(&self) -> impl Future<Output = Result<Uuid, JsValue>> {
        let uuid = generate_uuid();

        let fut = self.set_uuid(uuid);

        async move {
            fut.await?;
            Ok(uuid)
        }
    }

    #[inline]
    pub fn real_id(&self) -> i32 {
        self.tab_id
    }

    pub fn focus(&self) -> impl Future<Output = Result<(), JsValue>> {
        let fut1 = browser.tabs().update(Some(self.tab_id), &object! {
            "active": true,
        });

        let fut2 = browser.windows().update(self.window_id, &object! {
            "focused": true,
        });

        async move {
            let _ = try_join!(JsFuture::from(fut1), JsFuture::from(fut2))?;
            Ok(())
        }
    }
}


#[derive(Debug)]
pub struct Window {
    window_id: i32,
}

impl Window {
    fn get_uuid(&self) -> impl Future<Output = Result<Option<Uuid>, JsValue>> {
        get_uuid(browser.sessions().get_window_value(self.window_id, intern("id")))
    }

    fn set_uuid(&self, uuid: Uuid) -> impl Future<Output = Result<(), JsValue>> {
        set_uuid(browser.sessions().set_window_value(self.window_id, intern("id"), &serialize(&uuid)))
    }

    fn set_new_uuid(&self) -> impl Future<Output = Result<Uuid, JsValue>> {
        let uuid = generate_uuid();

        let fut = self.set_uuid(uuid);

        async move {
            fut.await?;
            Ok(uuid)
        }
    }

    fn set_sidebar(&self, url: &str) -> impl Future<Output = Result<(), JsValue>> {
        let fut = browser.sidebar_action().set_panel(&object! {
            "panel": url,
            "windowId": self.window_id,
        });

        async move {
            let _ = JsFuture::from(fut).await?;
            Ok(())
        }
    }

    #[inline]
    pub fn real_id(&self) -> i32 {
        self.window_id
    }
}


#[derive(Debug)]
struct BrowserState {
    tabs: Mapping<Tab>,
    windows: Mapping<Window>,
}

impl BrowserState {
    fn new_tab(&mut self, browser_tab: &web_extension::Tab) -> TabState {
        let id = Id::new();

        let tab_id = browser_tab.id().unwrap();

        self.tabs.insert(tab_id, id, Tab {
            tab_id,
            window_id: browser_tab.window_id(),
            detached: None
        });

        TabState::new(id, browser_tab)
    }

    fn new_window(&mut self, browser_window: &web_extension::Window) -> WindowState {
        let id = Id::new();
        let window_id = browser_window.id().unwrap();

        let tabs = browser_window.tabs().map(|array| {
            array.iter().map(|tab| {
                let tab: web_extension::Tab = tab.unchecked_into();
                self.new_tab(&tab)
            }).collect()
        }).unwrap_or_else(|| vec![]);

        self.windows.insert(window_id, id, Window { window_id });

        WindowState::new(id, tabs, browser_window)
    }

    fn create_or_update_tab(&mut self, timestamp: f64, browser_tab: &web_extension::Tab) -> Option<BrowserChange> {
        // If the tab is in a normal window
        if let Some(window_id) = self.windows.get_key(browser_tab.window_id()) {
            let tab_id = browser_tab.id().unwrap();

            if let Some(id) = self.tabs.get_key(tab_id) {
                Some(BrowserChange::TabUpdated {
                    timestamp,
                    tab: TabState::new(id, &browser_tab),
                    window_id,
                })

            } else {
                Some(BrowserChange::TabCreated {
                    timestamp,
                    tab: self.new_tab(&browser_tab),
                    window_id,
                    index: browser_tab.index(),
                })
            }

        } else {
            None
        }
    }
}


#[derive(Debug)]
pub struct Browser {
    state: Rc<RefCell<BrowserState>>,
}

impl Browser {
    pub fn new() -> Self {
        Self {
            state: Rc::new(RefCell::new(BrowserState {
                tabs: Mapping::new(),
                windows: Mapping::new(),
            })),
        }
    }

    pub fn get_tab<A, F>(&self, id: Id, f: F) -> A where F: FnOnce(Option<&Tab>) -> A {
        f(self.state.borrow().tabs.get_value(id))
    }

    pub fn get_window<A, F>(&self, id: Id, f: F) -> A where F: FnOnce(Option<&Window>) -> A {
        f(self.state.borrow().windows.get_value(id))
    }

    fn get_uuid<GF, G, SF, S>(&self, get: G, set: S) -> impl Future<Output = Result<Option<Uuid>, JsValue>>
        where GF: Future<Output = Result<Option<Uuid>, JsValue>> + 'static,
              G: FnOnce(&BrowserState) -> Option<GF>,
              SF: Future<Output = Result<Uuid, JsValue>>,
              S: FnOnce(&BrowserState) -> Option<SF> + 'static {

        let state = self.state.clone();

        let fut = get(&state.borrow());

        let fut = fut.map(move |fut| {
            /*let uuid = generate_uuid();

            let fut = set(value, uuid);

            async move {
                fut.await?;
                Ok(Some(uuid)) as Result<Option<Uuid>, JsValue>
            }*/

            async move {
                if let Some(uuid) = fut.await? {
                    Ok(Some(uuid))

                } else {
                    let fut = set(&state.borrow());

                    if let Some(fut) = fut {
                        Ok(Some(fut.await?))

                    } else {
                        Ok(None)
                    }
                }
            }
        });

        // TODO remove this boxed
        async move {
            if let Some(fut) = fut {
                fut.await

            } else {
                Ok(None)
            }
        }.boxed_local()
    }

    pub fn get_window_uuid(&self, id: Id) -> impl Future<Output = Result<Option<Uuid>, JsValue>> {
        self.get_uuid(
            move |state| state.windows.get_value(id).map(Window::get_uuid),
            move |state| state.windows.get_value(id).map(Window::set_new_uuid),
        )
    }

    pub fn get_tab_uuid(&self, id: Id) -> impl Future<Output = Result<Option<Uuid>, JsValue>> {
        self.get_uuid(
            move |state| state.tabs.get_value(id).map(Tab::get_uuid),
            move |state| state.tabs.get_value(id).map(Tab::set_new_uuid),
        )
    }

    pub fn get_tab_real_id(&self, id: Id) -> Option<i32> {
        self.state.borrow().tabs.get_value(id).map(|tab| tab.tab_id)
    }

    pub fn set_sidebar(&self, id: Id, url: &str) -> impl Future<Output = Result<(), JsValue>> {
        let fut = self.state.borrow().windows.get_value(id).map(|window| window.set_sidebar(url));

        async move {
            if let Some(fut) = fut {
                fut.await?;
            }

            Ok(())
        }
    }

    pub fn create_tab<A, F>(&self, obj: &js_sys::Object, f: F) -> impl Future<Output = Result<A, JsValue>>
        where F: FnOnce(&Tab) -> A {

        let fut = browser.tabs().create(&obj);

        let state = self.state.clone();

        async move {
            let tab = JsFuture::from(fut).await?.unchecked_into::<web_extension::Tab>();

            let mut state = state.borrow_mut();

            let tab_id = tab.id().unwrap();

            let (_, tab) = state.tabs.get_mut(tab_id).unwrap();

            Ok(f(&tab))
        }
    }

    pub fn current(&self) -> impl Future<Output = Result<Vec<WindowState>, JsValue>> {
        // TODO should this be inside the async ?
        let fut = JsFuture::from(browser.windows().get_all(&object! {
            "populate": true,
            "windowTypes": array![ intern("normal") ],
        }));

        let state = self.state.clone();

        async move {
            let windows = fut.await?;

            let mut state = state.borrow_mut();

            Ok(windows
                .unchecked_into::<Array>()
                .iter()
                .map(|window| {
                    let window: web_extension::Window = window.unchecked_into();
                    state.new_window(&window)
                })
                .collect())
        }
    }

    pub fn changes(&self) -> impl Stream<Item = BrowserChange> {
        let (sender, receiver) = mpsc::unbounded();

        let state = self.state.clone();

        BrowserChanges {
            _window_created: Listener::new(browser.windows().on_created(), Closure::new(clone!(sender, state => move |window: web_extension::Window| {
                let timestamp = Date::now();

                if window.type_().map(|x| x == "normal").unwrap_or(false) {
                    let window = state.borrow_mut().new_window(&window);

                    sender.unbounded_send(
                        BrowserChange::WindowCreated { timestamp, window }
                    ).unwrap();
                }
            }))),

            _window_removed: Listener::new(browser.windows().on_removed(), Closure::new(clone!(sender, state => move |window_id: i32| {
                let timestamp = Date::now();

                let id = state.borrow_mut().windows.remove(window_id);

                if let Some((window_id, _)) = id {
                    sender.unbounded_send(
                        BrowserChange::WindowRemoved { timestamp, window_id }
                    ).unwrap();
                }
            }))),

            _window_focused: Listener::new(browser.windows().on_focus_changed(), Closure::new(clone!(sender, state => move |window_id: i32| {
                let timestamp = Date::now();

                let window_id = if window_id == browser.windows().window_id_none() {
                    None

                } else {
                    state.borrow().windows.get_key(window_id)
                };

                sender.unbounded_send(
                    BrowserChange::WindowFocused { timestamp, window_id }
                ).unwrap();
            }))),

            _tab_created: Listener::new(browser.tabs().on_created(), Closure::new(clone!(sender, state => move |tab: web_extension::Tab| {
                let timestamp = Date::now();
                let message = state.borrow_mut().create_or_update_tab(timestamp, &tab);

                if let Some(message) = message {
                    sender.unbounded_send(message).unwrap();
                }
            }))),

            _tab_updated: Listener::new(browser.tabs().on_updated(), Closure::new(clone!(sender, state => move |_tab_id: i32, _change_info: JsValue, tab: web_extension::Tab| {
                let timestamp = Date::now();
                let message = state.borrow_mut().create_or_update_tab(timestamp, &tab);

                if let Some(message) = message {
                    sender.unbounded_send(message).unwrap();
                }
            }))),

            _tab_replaced: Listener::new(browser.tabs().on_replaced(), Closure::new(clone!(state => move |new_tab_id: i32, old_tab_id: i32| {
                if let Some(tab) = state.borrow_mut().tabs.move_key(old_tab_id, new_tab_id) {
                    tab.tab_id = new_tab_id;
                }
            }))),

            _tab_focused: Listener::new(browser.tabs().on_activated(), Closure::new(clone!(sender, state => move |active_info: web_extension::TabActiveInfo| {
                let timestamp = Date::now();

                let message = {
                    let state = state.borrow();

                    if let Some(window_id) = state.windows.get_key(active_info.window_id()) {
                        if let Some(tab_id) = state.tabs.get_key(active_info.tab_id()) {
                            let old_tab_id = active_info.previous_tab_id().and_then(|tab_id| state.tabs.get_key(tab_id));

                            if old_tab_id == Some(tab_id) {
                                warn!("New focused tab is the same as the old focused tab: {:?}", tab_id);
                            }

                            Some(BrowserChange::TabFocused { timestamp, tab_id, window_id })

                        } else {
                            None
                        }

                    } else {
                        None
                    }
                };

                if let Some(message) = message {
                    sender.unbounded_send(message).unwrap();
                }
            }))),

            _tab_detached: Listener::new(browser.tabs().on_detached(), Closure::new(clone!(state => move |tab_id: i32, detach_info: web_extension::TabDetachInfo| {
                let state: &mut BrowserState = &mut state.borrow_mut();

                // TODO should this set tab.window_id to None ?
                if let Some((_, tab)) = state.tabs.get_mut(tab_id) {
                    let window_id = state.windows.get_key(detach_info.old_window_id()).unwrap();

                    tab.detached = Some(TabDetached {
                        window_id,
                        index: detach_info.old_position(),
                    });
                }
            }))),

            _tab_attached: Listener::new(browser.tabs().on_attached(), Closure::new(clone!(sender, state => move |tab_id: i32, attach_info: web_extension::TabAttachInfo| {
                let timestamp = Date::now();

                let message = {
                    let mut state = state.borrow_mut();

                    if let Some((tab_id, tab)) = state.tabs.get_mut(tab_id) {
                        let detached = tab.detached.take().unwrap();

                        let window_id = attach_info.new_window_id();

                        tab.window_id = window_id;

                        Some(BrowserChange::TabAttached {
                            timestamp,
                            tab_id,

                            old_window_id: detached.window_id,
                            old_index: detached.index,

                            new_window_id: state.windows.get_key(window_id).unwrap(),
                            new_index: attach_info.new_position(),
                        })

                    } else {
                        None
                    }
                };

                if let Some(message) = message {
                    sender.unbounded_send(message).unwrap();
                }
            }))),

            _tab_moved: Listener::new(browser.tabs().on_moved(), Closure::new(clone!(sender, state => move |tab_id: i32, move_info: web_extension::TabMoveInfo| {
                let timestamp = Date::now();

                let message = {
                    let state = state.borrow();

                    if let Some(tab_id) = state.tabs.get_key(tab_id) {
                        let old_index = move_info.from_index();
                        let new_index = move_info.to_index();

                        if old_index == new_index {
                            None

                        } else {
                            let window_id = state.windows.get_key(move_info.window_id()).unwrap();

                            Some(BrowserChange::TabMoved { timestamp, tab_id, window_id, old_index, new_index })
                        }

                    } else {
                        None
                    }
                };

                if let Some(message) = message {
                    sender.unbounded_send(message).unwrap();
                }
            }))),

            _tab_removed: Listener::new(browser.tabs().on_removed(), Closure::new(move |tab_id: i32, remove_info: web_extension::TabRemoveInfo| {
                let timestamp = Date::now();

                let message = {
                    let mut state = state.borrow_mut();

                    if let Some((tab_id, _)) = state.tabs.remove(tab_id) {
                        let window_id = state.windows.get_key(remove_info.window_id()).unwrap();

                        Some(BrowserChange::TabRemoved {
                            timestamp,
                            tab_id,
                            window_id,
                            is_window_closing: remove_info.is_window_closing(),
                        })

                    } else {
                        None
                    }
                };

                if let Some(message) = message {
                    sender.unbounded_send(message).unwrap();
                }
            })),

            receiver,
        }
    }
}



#[derive(Debug)]
pub enum BrowserChange {
    WindowCreated {
        timestamp: f64,
        window: WindowState,
    },
    WindowRemoved {
        timestamp: f64,
        window_id: Id,
    },
    WindowFocused {
        timestamp: f64,
        window_id: Option<Id>,
    },
    TabCreated {
        timestamp: f64,
        window_id: Id,
        tab: TabState,
        index: u32,
    },
    TabUpdated {
        timestamp: f64,
        window_id: Id,
        tab: TabState,
    },
    TabFocused {
        timestamp: f64,
        window_id: Id,
        tab_id: Id,
    },
    TabAttached {
        timestamp: f64,
        tab_id: Id,

        old_window_id: Id,
        old_index: u32,

        new_window_id: Id,
        new_index: u32,
    },
    TabMoved {
        timestamp: f64,
        window_id: Id,
        tab_id: Id,
        old_index: u32,
        new_index: u32,
    },
    TabRemoved {
        timestamp: f64,
        window_id: Id,
        tab_id: Id,
        is_window_closing: bool,
    },
}


struct BrowserChanges {
    _window_created: Listener<dyn FnMut(web_extension::Window)>,
    _window_removed: Listener<dyn FnMut(i32)>,
    _window_focused: Listener<dyn FnMut(i32)>,
    _tab_created: Listener<dyn FnMut(web_extension::Tab)>,
    _tab_focused: Listener<dyn FnMut(web_extension::TabActiveInfo)>,
    _tab_detached: Listener<dyn FnMut(i32, web_extension::TabDetachInfo)>,
    _tab_replaced: Listener<dyn FnMut(i32, i32)>,
    _tab_attached: Listener<dyn FnMut(i32, web_extension::TabAttachInfo)>,
    _tab_moved: Listener<dyn FnMut(i32, web_extension::TabMoveInfo)>,
    _tab_updated: Listener<dyn FnMut(i32, JsValue, web_extension::Tab)>,
    _tab_removed: Listener<dyn FnMut(i32, web_extension::TabRemoveInfo)>,
    receiver: mpsc::UnboundedReceiver<BrowserChange>,
}

impl Stream for BrowserChanges {
    type Item = BrowserChange;

    #[inline]
    fn poll_next(mut self: std::pin::Pin<&mut Self>, cx: &mut std::task::Context) -> std::task::Poll<Option<Self::Item>> {
        std::pin::Pin::new(&mut self.receiver).poll_next(cx)
    }
}
