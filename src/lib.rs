#![warn(unreachable_pub)]

use std::borrow::Borrow;
use std::rc::Rc;
use std::cell::RefCell;
use std::sync::Arc;
use futures_signals::signal::{Signal, SignalExt};
use futures::channel::mpsc;
use futures::stream::Stream;
use std::future::Future;
use dominator::{clone, RefFn};
use dominator::animation::{easing, Percentage};
use uuid::Uuid;
use js_sys::{Date, Object, Reflect, Array, Set};
use web_sys::{window, Performance, Storage};
use wasm_bindgen_futures::futures_0_3::{JsFuture, spawn_local};
use wasm_bindgen::{JsCast, intern};
use wasm_bindgen::prelude::*;
use serde::Serialize;
use serde::de::DeserializeOwned;
use web_extension::{browser, Window, Tab, TabActiveInfo, TabDetachInfo, TabAttachInfo, TabMoveInfo, TabRemoveInfo};


pub mod state;


pub fn str_default<'a, A: Borrow<String>>(x: &'a Option<A>, default: &'a str) -> &'a str {
    x.as_ref().map(|x| x.borrow().as_str()).unwrap_or(default)
}

pub fn option_str(x: Option<Arc<String>>) -> Option<RefFn<Arc<String>, str, impl Fn(&Arc<String>) -> &str>> {
    x.map(|x| RefFn::new(x, move |x| x.as_str()))
}

pub fn option_str_default<A: Borrow<String>>(x: Option<A>, default: &'static str) -> RefFn<Option<A>, str, impl Fn(&Option<A>) -> &str> {
    RefFn::new(x, move |x| str_default(x, default))
}

pub fn option_str_default_fn<A, F>(x: Option<A>, default: &'static str, f: F) -> RefFn<Option<A>, str, impl Fn(&Option<A>) -> &str> where F: Fn(&A) -> &Option<String> {
    RefFn::new(x, move |x| {
        if let Some(x) = x {
            if let Some(x) = f(x) {
                x.as_str()

            } else {
                default
            }

        } else {
            default
        }
    })
}

pub fn is_empty<A: Borrow<String>>(input: &Option<A>) -> bool {
    input.as_ref().map(|x| x.borrow().len() == 0).unwrap_or(true)
}

pub fn px(t: f64) -> String {
    // TODO find which spots should be rounded and which shouldn't ?
    format!("{}px", t.round())
}

pub fn px_range(t: Percentage, min: f64, max: f64) -> String {
    px(t.range_inclusive(min, max))
}

pub fn float_range(t: Percentage, min: f64, max: f64) -> String {
    t.range_inclusive(min, max).to_string()
}

pub fn ease(t: Percentage) -> Percentage {
    easing::in_out(t, easing::cubic)
}


#[macro_export]
macro_rules! cursor {
    ($this:ident, $signal:expr, $type:expr) => {
        $this.style_signal("cursor", $signal.map(move |is_dragging| {
            if is_dragging {
                None

            } else {
                Some($type)
            }
        }))
    };
}

pub fn none_if<A, F>(signal: A, none_if: f64, mut f: F, min: f64, max: f64) -> impl Signal<Item = Option<String>>
    where A: Signal<Item = Percentage>,
          F: FnMut(Percentage, f64, f64) -> String {
    signal.map(move |t| t.none_if(none_if).map(|t| f(ease(t), min, max)))
}

pub fn none_if_px(value: f64) -> impl FnMut(f64) -> Option<String> {
    move |t| {
        if t == value {
            None

        } else {
            Some(px(t))
        }
    }
}


// TODO put this into a separate crate or something ?
pub fn normalize(value: f64, min: f64, max: f64) -> f64 {
    // TODO is this correct ?
    if min == max {
        0.0

    } else {
        ((value - min) * (1.0 / (max - min))).max(0.0).min(1.0)
    }
}


#[inline]
pub fn performance_now() -> f64 {
    thread_local! {
        static PERFORMANCE: Performance = window().unwrap_throw().performance().unwrap_throw();
    }

    PERFORMANCE.with(|a| a.now())
}

#[macro_export]
macro_rules! time {
    ($name:expr, $value:expr) => {{
        let old = $crate::performance_now();
        let value = $value;
        let new = $crate::performance_now();
        $crate::log!("{} took {}ms", $name, new - old);
        value
    }}
}


/*pub fn timestamp(name: &str) {
    web_sys::console::time_stamp_with_data(&JsValue::from(name))
}

#[macro_export]
macro_rules! profile {
    ($name:expr, $value:expr) => {{
        let name = $name;
        $crate::timestamp(&name);
        let value = $value;
        $crate::timestamp(&name);
        //js! { @(no_return) setTimeout(function () { console.profileEnd(@{&name}); }, 0); }
        value
    }}
}*/


#[macro_export]
macro_rules! log {
    ($($args:tt)*) => {
        web_sys::console::log_1(&wasm_bindgen::JsValue::from(format!($($args)*)));
    };
}


pub fn unwrap_future<F>(future: F) -> impl Future<Output = ()>
    where F: Future<Output = Result<(), JsValue>> {
    async {
        if let Err(e) = future.await {
            // TODO better logging of the error
            wasm_bindgen::throw_val(e);
        }
    }
}


pub fn spawn<A>(future: A) where A: Future<Output = Result<(), JsValue>> + 'static {
    spawn_local(unwrap_future(future))
}


/*
// TODO verify that this is cryptographically secure
fn generate_random_bytes() -> [u8; 16] {
    // TODO maybe this thread_local doesn't actually help performance ?
    thread_local! {
        static UUID_ARRAY: Uint8Array = Uint8Array::new_with_length(16);

        static CRYPTO: web_sys::Crypto = window().unwrap_throw().crypto().unwrap_throw();
    }

    CRYPTO.with(|crypto| {
        UUID_ARRAY.with(|array| {
            crypto.get_random_values_with_array_buffer_view(&array).unwrap_throw();

            let mut out = [0; 16];
            array.copy_to(&mut out);
            out
        })
    })
}*/

pub fn generate_uuid() -> Uuid {
    Uuid::new_v4()
}


thread_local! {
    static STORAGE: Storage = window()
        .unwrap_throw()
        .local_storage()
        .unwrap_throw()
        .unwrap_throw();
}

pub fn local_storage_get(key: &str) -> Option<String> {
    STORAGE.with(|x| x.get_item(key).unwrap_throw())
}

pub fn local_storage_set(key: &str, value: &str) {
    STORAGE.with(|x| x.set_item(key, value).unwrap_throw())
}


#[derive(Debug)]
pub enum StackVec<A> {
    Single(A),
    Multiple(Vec<A>),
}

impl<A> StackVec<A> {
    pub fn any<F>(&self, mut f: F) -> bool where F: FnMut(&A) -> bool {
        match self {
            StackVec::Single(value) => {
                f(value)
            },
            StackVec::Multiple(values) => {
                values.into_iter().any(f)
            },
        }
    }

    #[inline]
    pub fn each<F>(&self, mut f: F) where F: FnMut(&A) {
        self.any(|value| {
            f(value);
            false
        });
    }
}


/*pub fn set_panic_hook<F>(hook: F) where F: Fn(String) + Send + Sync + 'static {
    std::panic::set_hook(Box::new(move |info| {
        hook(info.to_string());
    }));
}*/


pub fn decode_uri_component(input: &str) -> String {
    js_sys::decode_uri_component(input).unwrap_throw().into()
}


pub fn window_height() -> f64 {
    window()
        .unwrap_throw()
        .inner_height()
        .unwrap_throw()
        .as_f64()
        .unwrap_throw()
}


pub struct Listener<A> where A: ?Sized {
    target: web_extension::Listener,
    closure: Option<Closure<A>>,
}

impl<A> Listener<A> where A: ?Sized {
    pub fn new(target: web_extension::Listener, closure: Closure<A>) -> Self {
        target.add_listener(closure.as_ref().unchecked_ref());
        Self { target, closure: Some(closure) }
    }
}

impl<A> Listener<A> where A: ?Sized + wasm_bindgen::closure::WasmClosure {
    pub fn forget(mut self) {
        self.closure.take().unwrap_throw().forget();
    }
}

impl<A> Drop for Listener<A> where A: ?Sized {
    fn drop(&mut self) {
        if let Some(closure) = &self.closure {
            self.target.remove_listener(closure.as_ref().unchecked_ref());
        }
    }
}


pub fn serialize_str<A>(value: &A) -> String where A: Serialize {
    serde_json::to_string(value).unwrap_throw()
}

pub fn serialize<A>(value: &A) -> JsValue where A: Serialize {
    JsValue::from(serialize_str(value))
}


pub fn deserialize_str<A>(value: &str) -> A where A: DeserializeOwned {
    serde_json::from_str(&value).unwrap_throw()
}

pub fn deserialize<A>(value: &JsValue) -> A where A: DeserializeOwned {
    let value = value.as_string().unwrap_throw();
    deserialize_str(&value)
}


#[derive(Debug)]
enum Change {
    Remove(JsValue),
    Set(JsValue, JsValue),
}

#[derive(Debug)]
struct TransactionState {
    changes: Vec<Change>,
    is_delayed: bool,
    timer: Option<Timer>,
}

impl TransactionState {
    fn new(is_delayed: bool) -> Rc<RefCell<Self>> {
        Rc::new(RefCell::new(Self {
            changes: vec![],
            is_delayed,
            timer: None,
        }))
    }

    // TODO use some sort of global lock to prevent overlapping commits ?
    fn commit(&mut self) {
        let start = performance_now();

        self.is_delayed = false;
        self.timer = None;

        if !self.changes.is_empty() {
            let updated = Object::new();
            let removed = Array::new();
            let seen = Set::new(&JsValue::null());

            let mut should_update = false;
            let mut should_remove = false;

            let mut iter = self.changes.drain(..);

            while let Some(change) = iter.next_back() {
                match change {
                    Change::Remove(key) => {
                        // If we have not seen the key yet...
                        if !seen.has(&key) {
                            seen.add(&key);
                            should_remove = true;
                            removed.push(&key);
                        }
                    },
                    Change::Set(key, value) => {
                        // If we have not seen the key yet...
                        if !seen.has(&key) {
                            seen.add(&key);
                            should_update = true;
                            Reflect::set(&updated, &key, &value).unwrap_throw();
                        }
                    },
                }
            }

            // TODO maybe use join ?
            if should_update {
                spawn(async move {
                    let _ = JsFuture::from(browser.storage().local().set(&updated)).await?;
                    let end = performance_now();
                    log!("Updating keys took {} ms", end - start);
                    Ok(())
                });
            }

            if should_remove {
                spawn(async move {
                    let _ = JsFuture::from(browser.storage().local().remove(&removed)).await?;
                    let end = performance_now();
                    log!("Removing keys took {} ms", end - start);
                    Ok(())
                });
            }
        }
    }

    fn delay(&self) -> u32 {
        if self.is_delayed {
            10_000

        } else {
            1_000
        }
    }

    fn start_commit(&mut self, state: &Rc<RefCell<Self>>) {
        if let None = self.timer {
            let state = state.clone();

            self.timer = Some(Timer::new(self.delay(), move || {
                let mut state = state.borrow_mut();
                state.commit();
            }));
        }
    }

    fn reset_timer(&mut self) {
        self.timer = None;
    }
}


#[derive(Debug)]
pub struct Transaction<'a> {
    db: &'a Object,
    state: &'a Rc<RefCell<TransactionState>>,
}

impl<'a> Transaction<'a> {
    pub fn get_raw(&self, key: &str) -> Option<JsValue> {
        // TODO make this more efficient
        let key = JsValue::from(key);

        if Reflect::has(&self.db, &key).unwrap_throw() {
            Some(Reflect::get(&self.db, &key).unwrap_throw())

        } else {
            None
        }
    }

    pub fn set_raw(&self, key: &str, value: JsValue) {
        // TODO make this more efficient
        let key = JsValue::from(key);

        Reflect::set(&self.db, &key, &value).unwrap_throw();

        let mut state = self.state.borrow_mut();

        state.changes.push(Change::Set(key, value));

        state.start_commit(&self.state);
    }

    pub fn get<T>(&self, key: &str) -> Option<T> where T: DeserializeOwned {
        let value = self.get_raw(key)?;
        Some(deserialize(&value))
    }

    pub fn get_or_insert<T, F>(&self, key: &str, f: F) -> T
        where T: Serialize + DeserializeOwned,
              F: FnOnce() -> T {
        match self.get(key) {
            Some(value) => value,
            None => {
                let out = f();
                self.set(key, &out);
                out
            },
        }
    }

    pub fn set<T>(&self, key: &str, value: &T) where T: Serialize {
        self.set_raw(key, serialize(value));
    }

    fn remove_raw(&self, key: JsValue) {
        Reflect::delete_property(&self.db, &key).unwrap_throw();

        let mut state = self.state.borrow_mut();

        state.changes.push(Change::Remove(key));

        state.start_commit(&self.state);
    }

    pub fn remove(&self, key: &str) {
        // TODO make this more efficient
        let key = JsValue::from(key);
        self.remove_raw(key);
    }

    pub fn clear(&self) {
        // TODO make this more efficient
        for key in Object::keys(&self.db).values() {
            self.remove_raw(key.unwrap_throw());
        }
    }
}


#[derive(Debug)]
pub struct Database {
    db: Object,
    state: Rc<RefCell<TransactionState>>,
}

impl Database {
    pub fn new() -> impl Future<Output = Result<Self, JsValue>> {
        async move {
            let db = JsFuture::from(browser.storage().local().get(&JsValue::null())).await?;
            let db: Object = db.unchecked_into();
            Ok(Self {
                db,
                state: TransactionState::new(false),
            })
        }
    }

    pub fn transaction<A, F>(&self, f: F) -> A where F: FnOnce(&Transaction) -> A {
        f(&Transaction {
            db: &self.db,
            state: &self.state,
        })
    }

    pub fn delay_transactions(&mut self) {
        {
            let mut state = self.state.borrow_mut();

            if state.is_delayed {
                assert!(state.timer.is_some());
                state.reset_timer();

            } else if let None = state.timer {
                assert_eq!(state.changes.len(), 0);
                state.is_delayed = true;

            } else {
                drop(state);
                self.state = TransactionState::new(true);
            }
        }

        self.state.borrow_mut().start_commit(&self.state);
    }

    pub fn debug(&self) {
        web_sys::console::log_1(&self.db);
    }
}


struct OnMessage<A> {
    _on_message: Listener<dyn FnMut(JsValue)>,
    _on_disconnect: Listener<dyn FnMut(web_extension::Port)>,
    receiver: mpsc::UnboundedReceiver<A>,
}

impl<A> Stream for OnMessage<A> {
    type Item = A;

    #[inline]
    fn poll_next(mut self: std::pin::Pin<&mut Self>, cx: &mut std::task::Context) -> std::task::Poll<Option<Self::Item>> {
        std::pin::Pin::new(&mut self.receiver).poll_next(cx)
    }
}


#[derive(Debug, Clone, PartialEq)]
pub struct Port {
    port: web_extension::Port,
}

impl Port {
    pub fn send_message_raw(&self, message: &JsValue) {
        self.port.post_message(message);
    }

    pub fn send_message<A>(&self, message: &A) where A: Serialize {
        self.send_message_raw(&serialize(message));
    }

    pub fn on_message<A>(&self) -> impl Stream<Item = A> where A: DeserializeOwned + 'static {
        let (sender, receiver) = mpsc::unbounded();

        let _on_message = Listener::new(self.port.on_message(), clone!(sender => Closure::new(move |message| {
            sender.unbounded_send(deserialize(&message)).unwrap_throw();
        })));

        let _on_disconnect = Listener::new(self.port.on_disconnect(), Closure::new(move |_| {
            sender.close_channel();
        }));

        OnMessage { _on_message, _on_disconnect, receiver }
    }
}


struct OnConnect {
    _listener: Listener<dyn FnMut(web_extension::Port)>,
    receiver: mpsc::UnboundedReceiver<Port>,
}

impl Stream for OnConnect {
    type Item = Port;

    #[inline]
    fn poll_next(mut self: std::pin::Pin<&mut Self>, cx: &mut std::task::Context) -> std::task::Poll<Option<Self::Item>> {
        std::pin::Pin::new(&mut self.receiver).poll_next(cx)
    }
}

pub fn on_connect() -> impl Stream<Item = Port> {
    let (sender, receiver) = mpsc::unbounded();

    let _listener = Listener::new(browser.runtime().on_connect(), Closure::new(move |port| {
        sender.unbounded_send(Port { port }).unwrap_throw();
    }));

    OnConnect { _listener, receiver }
}


pub fn connect(name: &str) -> Port {
    Port {
        port: browser.runtime().connect(None, &object! {
            "name": name,
        }),
    }
}


/*pub fn on_message<S, D, P, F>(mut f: F) -> Listener<dyn FnMut(String, JsValue, JsValue) -> Promise>
    where D: DeserializeOwned,
          S: Serialize,
          P: Future<Output = Result<S, JsValue>> + 'static,
          F: FnMut(D) -> P + 'static {

    Listener::new(browser.runtime().on_message(), Closure::new(move |message: String, _: JsValue, _: JsValue| {
        let message: D = serde_json::from_str(&message).unwrap_throw();
        let future = f(message);
        future_to_promise(async move {
            let reply = future.await?;
            let reply = serde_json::to_string(&reply).unwrap_throw();
            Ok(JsValue::from(reply))
        })
    }))
}


pub fn send_message<A, B>(message: &A) -> impl Future<Output = Result<B, JsValue>>
    where A: Serialize,
          B: DeserializeOwned {
    let message = serialize(message);

    async move {
        let reply = JsFuture::from(browser.runtime().send_message(None, &message, None)).await?;
        Ok(deserialize(&reply))
    }
}*/


#[macro_export]
macro_rules! array {
    ($($value:expr),*) => {{
        let array = js_sys::Array::new();
        $(array.push(&wasm_bindgen::JsValue::from($value));)*
        array
    }};
}

#[macro_export]
macro_rules! object {
    ($($key:literal: $value:expr,)*) => {{
        let obj = js_sys::Object::new();
        // TODO make this more efficient
        $(wasm_bindgen::UnwrapThrowExt::unwrap_throw(js_sys::Reflect::set(
            &obj,
            &wasm_bindgen::JsValue::from(wasm_bindgen::intern($key)),
            &wasm_bindgen::JsValue::from($value),
        ));)*
        obj
    }};
}


#[derive(Debug)]
pub enum WindowChange {
    WindowCreated {
        window: Window,
    },
    WindowRemoved {
        window_id: i32,
    },
    WindowFocused {
        window_id: Option<i32>,
    },
    TabCreated {
        tab: Tab,
    },
    TabFocused {
        old_tab_id: Option<i32>,
        new_tab_id: i32,
        window_id: i32,
    },
    TabDetached {
        tab_id: i32,
        old_window_id: i32,
        old_index: u32,
    },
    TabAttached {
        tab_id: i32,
        new_window_id: i32,
        new_index: u32,
    },
    TabMoved {
        tab_id: i32,
        window_id: i32,
        old_index: u32,
        new_index: u32,
    },
    TabUpdated {
        tab: Tab,
    },
    TabRemoved {
        tab_id: i32,
        window_id: i32,
        is_window_closing: bool,
    },
}

#[derive(Debug)]
pub struct Windows;

impl Windows {
    pub fn current() -> impl Future<Output = Result<Vec<Window>, JsValue>> {
        async move {
            let windows = JsFuture::from(browser.windows().get_all(&object! {
                "populate": true,
                "windowTypes": array![ intern("normal") ],
            })).await?;

            // TODO make this more efficient
            let windows: Vec<Window> = windows
                .unchecked_into::<Array>()
                .values()
                .into_iter()
                .map(|x| x.unwrap_throw().unchecked_into())
                .collect();

            Ok(windows)
        }
    }

    // TODO browser.tabs.onReplaced
    pub fn changes() -> impl Stream<Item = WindowChange> {
        let (sender, receiver) = mpsc::unbounded();

        WindowsChanges {
            _window_created: Listener::new(browser.windows().on_created(), Closure::new(clone!(sender => move |window| {
                sender.unbounded_send(
                    WindowChange::WindowCreated { window }
                ).unwrap_throw();
            }))),

            _window_removed: Listener::new(browser.windows().on_removed(), Closure::new(clone!(sender => move |window_id| {
                sender.unbounded_send(
                    WindowChange::WindowRemoved { window_id }
                ).unwrap_throw();
            }))),

            _window_focused: Listener::new(browser.windows().on_focus_changed(), Closure::new(clone!(sender => move |window_id| {
                sender.unbounded_send(
                    WindowChange::WindowFocused {
                        window_id: if window_id == browser.windows().window_id_none() {
                            None

                        } else {
                            Some(window_id)
                        }
                    }
                ).unwrap_throw();
            }))),

            _tab_created: Listener::new(browser.tabs().on_created(), Closure::new(clone!(sender => move |tab| {
                sender.unbounded_send(
                    WindowChange::TabCreated { tab }
                ).unwrap_throw();
            }))),

            _tab_focused: Listener::new(browser.tabs().on_activated(), Closure::new(clone!(sender => move |active_info: TabActiveInfo| {
                sender.unbounded_send(
                    WindowChange::TabFocused {
                        old_tab_id: active_info.previous_tab_id(),
                        new_tab_id: active_info.tab_id(),
                        window_id: active_info.window_id(),
                    }
                ).unwrap_throw();
            }))),

            _tab_detached: Listener::new(browser.tabs().on_detached(), Closure::new(clone!(sender => move |tab_id, detach_info: TabDetachInfo| {
                sender.unbounded_send(
                    WindowChange::TabDetached {
                        tab_id,
                        old_window_id: detach_info.old_window_id(),
                        old_index: detach_info.old_position(),
                    }
                ).unwrap_throw();
            }))),

            _tab_attached: Listener::new(browser.tabs().on_attached(), Closure::new(clone!(sender => move |tab_id, attach_info: TabAttachInfo| {
                sender.unbounded_send(
                    WindowChange::TabAttached {
                        tab_id,
                        new_window_id: attach_info.new_window_id(),
                        new_index: attach_info.new_position(),
                    }
                ).unwrap_throw();
            }))),

            _tab_moved: Listener::new(browser.tabs().on_moved(), Closure::new(clone!(sender => move |tab_id, move_info: TabMoveInfo| {
                sender.unbounded_send(
                    WindowChange::TabMoved {
                        tab_id,
                        window_id: move_info.window_id(),
                        old_index: move_info.from_index(),
                        new_index: move_info.to_index(),
                    }
                ).unwrap_throw();
            }))),

            _tab_updated: Listener::new(browser.tabs().on_updated(), Closure::new(clone!(sender => move |_tab_id, _change_info, tab| {
                sender.unbounded_send(
                    WindowChange::TabUpdated { tab }
                ).unwrap_throw();
            }))),

            _tab_removed: Listener::new(browser.tabs().on_removed(), Closure::new(clone!(sender => move |tab_id, remove_info: TabRemoveInfo| {
                sender.unbounded_send(
                    WindowChange::TabRemoved {
                        tab_id,
                        window_id: remove_info.window_id(),
                        is_window_closing: remove_info.is_window_closing(),
                    }
                ).unwrap_throw();
            }))),

            receiver,
        }
    }
}

struct WindowsChanges {
    _window_created: Listener<dyn FnMut(Window)>,
    _window_removed: Listener<dyn FnMut(i32)>,
    _window_focused: Listener<dyn FnMut(i32)>,
    _tab_created: Listener<dyn FnMut(Tab)>,
    _tab_focused: Listener<dyn FnMut(TabActiveInfo)>,
    _tab_detached: Listener<dyn FnMut(i32, TabDetachInfo)>,
    _tab_attached: Listener<dyn FnMut(i32, TabAttachInfo)>,
    _tab_moved: Listener<dyn FnMut(i32, TabMoveInfo)>,
    _tab_updated: Listener<dyn FnMut(i32, JsValue, Tab)>,
    _tab_removed: Listener<dyn FnMut(i32, TabRemoveInfo)>,
    receiver: mpsc::UnboundedReceiver<WindowChange>,
}

impl Stream for WindowsChanges {
    type Item = WindowChange;

    #[inline]
    fn poll_next(mut self: std::pin::Pin<&mut Self>, cx: &mut std::task::Context) -> std::task::Poll<Option<Self::Item>> {
        std::pin::Pin::new(&mut self.receiver).poll_next(cx)
    }
}


/*
// TODO move this into stdweb
#[derive(Clone, PartialEq, Eq, ReferenceType)]
#[reference(instance_of = "RegExp")]
pub struct RegExp(Reference);

impl RegExp {
    #[inline]
    pub fn new(pattern: &str, flags: &str) -> Self {
        js!( return new RegExp(@{pattern}, @{flags}); ).try_into().unwrap()
    }

    #[inline]
    pub fn is_match(&self, input: &str) -> bool {
        js!(
            var self = @{self};
            var is_match = self.test(@{input});
            self.lastIndex = 0;
            return is_match;
        ).try_into().unwrap()
    }

    #[inline]
    pub fn first_match(&self, input: &str) -> Option<Vec<Option<String>>> {
        js!(
            var self = @{self};
            var array = self.exec(@{input});
            self.lastIndex = 0;
            return array;
        ).try_into().unwrap()
    }

    #[inline]
    pub fn replace(&self, input: &str, replace: &str) -> String {
        js!(
            return @{input}.replace(@{self}, @{replace});
        ).try_into().unwrap()
    }

    // TODO implement this more efficiently
    // TODO verify that this is correct
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
    #[inline]
    pub fn escape(input: &str) -> String {
        js!( return @{input}.replace(new RegExp("[.*+?^${}()|[\\]\\\\]", "g"), "\\$&"); ).try_into().unwrap()
    }
}

impl fmt::Debug for RegExp {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        let pattern: String = js!( return @{self}.source; ).try_into().unwrap();
        let flags: String = js!( return @{self}.flags; ).try_into().unwrap();
        f.debug_tuple("RegExp")
            .field(&pattern)
            .field(&flags)
            .finish()
    }
}*/


pub fn round_to_hour(time: f64) -> f64 {
    // TODO direct f64 bindings for Date
    let t = Date::new(&JsValue::from(time));
    t.set_utc_minutes(0);
    t.set_utc_seconds(0);
    t.set_utc_milliseconds(0);
    t.get_time()
}


pub struct TimeDifference {
    pub years: f64,
    pub weeks: f64,
    pub days: f64,
    pub hours: f64,
    pub minutes: f64,
    pub seconds: f64,
    pub milliseconds: f64,
}

impl TimeDifference {
    pub const YEAR: f64 = 365.25 * Self::DAY;
    pub const WEEK: f64 = 7.0 * Self::DAY;
    pub const DAY: f64 = 24.0 * Self::HOUR;
    pub const HOUR: f64 = 60.0 * Self::MINUTE;
    pub const MINUTE: f64 = 60.0 * Self::SECOND;
    pub const SECOND: f64 = 1000.0 * Self::MILLISECOND;
    pub const MILLISECOND: f64 = 1.0;

    // TODO figure out a better way to do this ?
    // TODO test this
    pub fn new(old: f64, new: f64) -> Self {
        let mut milliseconds = (new - old).abs();

        let years = (milliseconds / Self::YEAR).floor();
        milliseconds -= years * Self::YEAR;

        let weeks = (milliseconds / Self::WEEK).floor();
        milliseconds -= weeks * Self::WEEK;

        let days = (milliseconds / Self::DAY).floor();
        milliseconds -= days * Self::DAY;

        let hours = (milliseconds / Self::HOUR).floor();
        milliseconds -= hours * Self::HOUR;

        let minutes = (milliseconds / Self::MINUTE).floor();
        milliseconds -= minutes * Self::MINUTE;

        let seconds = (milliseconds / Self::SECOND).floor();
        milliseconds -= seconds * Self::SECOND;

        Self { years, weeks, days, hours, minutes, seconds, milliseconds }
    }

    // TODO test this
    // TODO make this more efficient
    pub fn pretty(&self) -> String {
        // TODO move this someplace else
        // TODO make this more efficient
        fn plural(x: f64, suffix: &str) -> String {
            if x == 1.0 {
                format!("{}{}", x, suffix)

            } else {
                format!("{}{}s", x, suffix)
            }
        }

        if self.years == 0.0 &&
           self.weeks == 0.0 &&
           self.days == 0.0 &&
           self.hours == 0.0 {
            "Less than an hour ago".to_string()

        } else {
            let mut output = vec![];

            if self.years > 0.0 {
                output.push(plural(self.years, " year"));
            }

            if self.weeks > 0.0 {
                output.push(plural(self.weeks, " week"));
            }

            if self.days > 0.0 {
                output.push(plural(self.days, " day"));
            }

            if self.hours > 0.0 {
                output.push(plural(self.hours, " hour"));
            }

            format!("{} ago", output.join(" "))
        }
    }
}


#[derive(Debug)]
pub struct Timer {
    closure: Option<Closure<dyn FnMut()>>,
    id: i32,
}

impl Timer {
    pub fn new<F>(ms: u32, f: F) -> Self where F: FnOnce() + 'static {
        let closure = Closure::once(f);

        let id = window()
            .unwrap_throw()
            .set_timeout_with_callback_and_timeout_and_arguments_0(
                closure.as_ref().unchecked_ref(),
                // TODO is this conversion correct ?
                ms as i32,
            )
            .unwrap_throw();

        Self { closure: Some(closure), id }
    }

    pub fn forget(mut self) {
        self.closure.take().unwrap_throw().forget();
    }
}

impl Drop for Timer {
    fn drop(&mut self) {
        if let Some(_) = self.closure {
            window()
                .unwrap_throw()
                .clear_timeout_with_handle(self.id);
        }
    }
}


pub fn set_interval<F>(f: F, ms: u32) where F: FnMut() + 'static {
    let f = Closure::wrap(Box::new(f) as Box<dyn FnMut()>);

    window()
        .unwrap_throw()
        .set_interval_with_callback_and_timeout_and_arguments_0(
            f.as_ref().unchecked_ref(),
            // TODO is this conversion correct ?
            ms as i32,
        )
        .unwrap_throw();

    f.forget();
}


// TODO make this more efficient ?
pub fn every_hour<F>(mut f: F) where F: FnMut() + 'static {
    // TODO is this okay ?
    const EXTRA_TIME_MARGIN: f64 = 10.0;

    let now = Date::now();
    let next = round_to_hour(now) + TimeDifference::HOUR + EXTRA_TIME_MARGIN;
    assert!(next > now);

    // TODO is this correct ?
    let diff = (next - now).ceil();

    Timer::new(diff as u32, move || {
        assert!(Date::now() >= next);
        f();
        every_hour(f);
    }).forget();
}
