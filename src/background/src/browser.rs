use std::rc::Rc;
use std::cell::RefCell;
use std::sync::atomic::{AtomicU32, Ordering};
use std::collections::HashMap;
use std::collections::hash_map::Entry;
use futures::channel::mpsc;
use futures::stream::Stream;
use std::future::Future;
use dominator::clone;
use uuid::Uuid;
use js_sys::{Array, Promise};
use wasm_bindgen_futures::JsFuture;
use wasm_bindgen::{JsCast, intern};
use wasm_bindgen::prelude::*;
use tab_organizer::{Listener, deserialize, serialize, object, array};
use web_extension::browser;


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

    fn has_key(&self, key: i32) -> bool {
        self.keys.contains_key(&key)
    }

    fn get_key(&self, key: i32) -> Option<Id> {
        self.keys.get(&key).map(|x| *x)
    }

    fn get_mut(&mut self, key: i32) -> Option<(Id, &mut A)> {
        let id = self.get_key(key)?;
        Some((id, self.values.get_mut(&id).unwrap()))
    }

    fn get_or_insert<F>(&mut self, key: i32, id: Id, set: F) -> &mut A where F: FnOnce() -> A {
        let entry = self.values.entry(id);

        match entry {
            Entry::Vacant(_) => {
                self.keys.insert(key, id).unwrap_none();
            },
            Entry::Occupied(_) => {
                assert_eq!(*self.keys.get(&key).unwrap(), id);
            },
        }

        entry.or_insert_with(set)
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


#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
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
pub enum TabStatus {
    New,
    Loading,
    Complete,
}

impl TabStatus {
    fn new(browser_tab: &web_extension::Tab) -> Self {
        match browser_tab.status().as_deref() {
            None => Self::New,
            Some("loading") => Self::Loading,
            Some("complete") => Self::Complete,
            Some(status) => panic!("Unknown tab status: {}", status),
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
    fn new(id: Id, browser_tab: &web_extension::Tab) -> Self {
        Self {
            id,
            focused: browser_tab.active(),
            pinned: browser_tab.pinned(),
            has_attention: browser_tab.attention().unwrap_or(false),
            audio: TabAudio::new(browser_tab),
            status: TabStatus::new(browser_tab),
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
    pub fn get_uuid(&self) -> impl Future<Output = Result<Option<Uuid>, JsValue>> {
        get_uuid(browser.sessions().get_tab_value(self.tab_id, intern("id")))
    }

    pub fn set_uuid(&self, uuid: Uuid) -> impl Future<Output = Result<(), JsValue>> {
        set_uuid(browser.sessions().set_tab_value(self.tab_id, intern("id"), &serialize(&uuid)))
    }

    /*fn to_tab(&self, window: &Window) -> Tab {
        Tab {
            // TODO figure out a way to avoid this clone
            serialized: self.serialized.clone(),
            focused: window.is_tab_focused(self.uuid),
            playing_audio: self.playing_audio,
        }
    }*/
}


#[derive(Debug)]
pub struct Window {
    window_id: i32,
}

impl Window {
    pub fn get_uuid(&self) -> impl Future<Output = Result<Option<Uuid>, JsValue>> {
        get_uuid(browser.sessions().get_window_value(self.window_id, intern("id")))
    }

    pub fn set_uuid(&self, uuid: Uuid) -> impl Future<Output = Result<(), JsValue>> {
        set_uuid(browser.sessions().set_window_value(self.window_id, intern("id"), &serialize(&uuid)))
    }

    /*pub fn is_tab_focused(&self, tab_id: i32) -> bool {
        match self.focused_tab {
            Some(id) => id == tab_id,
            None => false,
        }
    }

    pub fn set_focused(&mut self, new_id: i32) -> Option<Option<i32>> {
        let old_id = self.focused_tab;

        if let Some(old_id) = old_id {
            if old_id == new_id {
                return None;
            }
        }

        self.focused_tab = Some(new_id);

        return Some(old_id);
    }

    pub fn unfocus_tab(&mut self, tab_id: i32) {
        if let Some(old_id) = self.focused_tab {
            if old_id == tab_id {
                self.focused_tab = None;
            }
        }
    }

    pub fn detach_tab(&mut self, tab_id: i32, index: usize) {
        assert_eq!(self.tabs.remove(index), tab_id);

        self.unfocus_tab(tab_id);
    }*/
}


/*let fut = get_window_id(window_id);

                    spawn(clone!(state => async move {
                        if let Some(id) = fut.await? {
                            Some(id)

                        } else {
                            if state.borrow().windows.contains(window_id) {
                                let id = generate_uuid();
                                set_window_id(window_id, id).await?;
                                Some(id)

                            // Window was removed
                            } else {
                                None
                            }
                        }
                    }));*/


#[derive(Debug)]
struct BrowserState {
    tabs: Mapping<Tab>,
    windows: Mapping<Window>,
}

impl BrowserState {
    fn new_tab(&mut self, browser_tab: &web_extension::Tab) -> TabState {
        let id = Id::new();
        let tab_id = browser_tab.id().unwrap();
        let window_id = browser_tab.window_id();

        self.tabs.insert(tab_id, id, Tab { tab_id, window_id, detached: None });

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

    fn create_or_update_tab(&mut self, browser_tab: &web_extension::Tab) -> Option<BrowserChange> {
        let window_id = browser_tab.window_id();

        // If the tab is in a normal window
        if self.windows.has_key(window_id) {
            let tab_id = browser_tab.id().unwrap();

            if let Some(id) = self.tabs.get_key(tab_id) {
                Some(BrowserChange::TabUpdated { tab: TabState::new(id, &browser_tab) })

            } else {
                Some(BrowserChange::TabCreated { tab: self.new_tab(&browser_tab) })
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
                if window.type_().map(|x| x == "normal").unwrap_or(false) {
                    let window = state.borrow_mut().new_window(&window);

                    sender.unbounded_send(
                        BrowserChange::WindowCreated { window }
                    ).unwrap();
                }
            }))),

            _window_removed: Listener::new(browser.windows().on_removed(), Closure::new(clone!(sender, state => move |window_id: i32| {
                let id = state.borrow_mut().windows.remove(window_id);

                if let Some((window_id, _)) = id {
                    sender.unbounded_send(
                        BrowserChange::WindowRemoved { window_id }
                    ).unwrap();
                }
            }))),

            _window_focused: Listener::new(browser.windows().on_focus_changed(), Closure::new(clone!(sender, state => move |window_id: i32| {
                let window_id = if window_id == browser.windows().window_id_none() {
                    None

                } else {
                    state.borrow().windows.get_key(window_id)
                };

                sender.unbounded_send(
                    BrowserChange::WindowFocused { window_id }
                ).unwrap();
            }))),

            _tab_created: Listener::new(browser.tabs().on_created(), Closure::new(clone!(sender, state => move |tab: web_extension::Tab| {
                let message = state.borrow_mut().create_or_update_tab(&tab);

                if let Some(message) = message {
                    sender.unbounded_send(message).unwrap();
                }
            }))),

            _tab_updated: Listener::new(browser.tabs().on_updated(), Closure::new(clone!(sender, state => move |_tab_id: i32, _change_info: JsValue, tab: web_extension::Tab| {
                let message = state.borrow_mut().create_or_update_tab(&tab);

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
                let message = {
                    let state = state.borrow();

                    if let Some(window_id) = state.windows.get_key(active_info.window_id()) {
                        let old_tab_id = active_info.previous_tab_id().map(|tab_id| state.tabs.get_key(tab_id).unwrap());
                        let new_tab_id = state.tabs.get_key(active_info.tab_id()).unwrap();
                        Some(BrowserChange::TabFocused { old_tab_id, new_tab_id, window_id })

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

                if let Some((_, tab)) = state.tabs.get_mut(tab_id) {
                    let window_id = state.windows.get_key(detach_info.old_window_id()).unwrap();

                    tab.detached = Some(TabDetached {
                        window_id,
                        index: detach_info.old_position(),
                    });
                }
            }))),

            _tab_attached: Listener::new(browser.tabs().on_attached(), Closure::new(clone!(sender, state => move |tab_id: i32, attach_info: web_extension::TabAttachInfo| {
                let message = {
                    let mut state = state.borrow_mut();

                    if let Some((tab_id, tab)) = state.tabs.get_mut(tab_id) {
                        let detached = tab.detached.take().unwrap();

                        let new_window_id = state.windows.get_key(attach_info.new_window_id()).unwrap();

                        Some(BrowserChange::TabAttached {
                            tab_id,

                            old_window_id: detached.window_id,
                            old_index: detached.index,

                            new_window_id,
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
                let message = {
                    let state = state.borrow();

                    if let Some(tab_id) = state.tabs.get_key(tab_id) {
                        let window_id = state.windows.get_key(move_info.window_id()).unwrap();

                        Some(BrowserChange::TabMoved {
                            tab_id,
                            window_id,
                            old_index: move_info.from_index(),
                            new_index: move_info.to_index(),
                        })

                    } else {
                        None
                    }
                };

                if let Some(message) = message {
                    sender.unbounded_send(message).unwrap();
                }
            }))),

            _tab_removed: Listener::new(browser.tabs().on_removed(), Closure::new(move |tab_id: i32, remove_info: web_extension::TabRemoveInfo| {
                let message = {
                    let mut state = state.borrow_mut();

                    if let Some((tab_id, _)) = state.tabs.remove(tab_id) {
                        let window_id = state.windows.get_key(remove_info.window_id()).unwrap();

                        Some(BrowserChange::TabRemoved {
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
        window: WindowState,
    },
    WindowRemoved {
        window_id: Id,
    },
    WindowFocused {
        window_id: Option<Id>,
    },
    TabCreated {
        tab: TabState,
    },
    TabFocused {
        old_tab_id: Option<Id>,
        new_tab_id: Id,
        window_id: Id,
    },
    TabAttached {
        tab_id: Id,

        old_window_id: Id,
        old_index: u32,

        new_window_id: Id,
        new_index: u32,
    },
    TabMoved {
        tab_id: Id,
        window_id: Id,
        old_index: u32,
        new_index: u32,
    },
    TabUpdated {
        tab: TabState,
    },
    TabRemoved {
        tab_id: Id,
        window_id: Id,
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
