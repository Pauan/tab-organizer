#![warn(unreachable_pub)]

use lazy_static::lazy_static;
use std::borrow::Borrow;
use std::rc::Rc;
use std::cell::RefCell;
use std::sync::Arc;
use std::pin::Pin;
use std::task::{Poll, Context};
use futures_signals::map_ref;
use futures_signals::signal::{Signal, SignalExt, Mutable};
use futures::channel::{oneshot, mpsc};
use futures::stream::Stream;
use futures::try_join;
use std::future::Future;
use dominator::{clone, RefFn};
use dominator::animation::{easing, Percentage};
use uuid::Uuid;
use js_sys::{Date, Object, Reflect, Array, Set, Error, Function};
use web_sys::{window, Window, Performance, Storage, Blob, Url, BlobPropertyBag, FileReader};
use wasm_bindgen_futures::{JsFuture, spawn_local};
use wasm_bindgen::closure::WasmClosure;
use wasm_bindgen::JsCast;
use wasm_bindgen::prelude::*;
use serde::Serialize;
use serde::de::DeserializeOwned;
use web_extension::browser;


// The logging is written in JS so it will keep working even if Rust/Wasm fails
#[wasm_bindgen(inline_js = "
    var max_messages = 1000;

    var logs = [];

    export function push_log(message) {
        logs.push(message);

        if (logs.length > max_messages) {
            logs.shift();
        }
    }

    export function set_print_logs() {
        window.print_logs = function (amount) {
            var len = logs.length;

            var first = (amount >= len ? 0 : len - amount);

            var messages = logs.slice(first).reverse();

            logs.length = first;

            if (messages.length > 0) {
                console.info(messages.join(\"\\n\\n\"));
            }
        };
    }

    export function set_global_function(name, f) {
        window[name] = f;
    }

    export function error_message(e) { return e.message + \"\\n--------------------\\n\" + e.stack; }
")]
extern "C" {
    fn push_log(message: &str);

    pub fn set_print_logs();

    fn set_global_function(name: &str, f: &Function);

    fn error_message(v: &JsValue) -> String;
}


pub fn global_function<F>(name: &str, f: Closure<F>) where F: WasmClosure + ?Sized {
    set_global_function(name, f.as_ref().unchecked_ref());
    // TODO is there a better way to do this ?
    f.forget();
}


// TODO use a better way of downloading which doesn't need the "downloads" permission
pub fn download(filename: &str, value: &str) -> impl Future<Output = Result<(), JsValue>> {
    let blob = Blob::new_with_str_sequence_and_options(
        array![ value ].as_ref(),
        BlobPropertyBag::new()
            .type_("application/json"),
    ).unwrap();

    let url = Url::create_object_url_with_blob(&blob).unwrap();

    let fut = browser.downloads().download(&object! {
        "url": JsValue::from(&url),
        "filename": filename,
        "saveAs": true,
        // TODO re-enable this after it's implemented by Firefox
        //"conflictAction": "prompt",
    });

    // The Promise returned by download only lets us know when the download has started
    // (not ended), so we have to set a far-future timeout to cleanup the Url.
    Timer::new(1_000 * 60 * 5, move || {
        Url::revoke_object_url(&url).unwrap();
    }).forget();

    async move {
        let id = JsFuture::from(fut).await?;
        log!("{:?}", id);
        Ok(())
    }
}


pub fn fallible_promise(promise: js_sys::Promise) -> impl Future<Output = Option<JsValue>> {
    async move {
        match JsFuture::from(promise).await {
            Ok(value) => Some(value),
            Err(error) => {
                crate::error(crate::pretty_time(), std::file!(), std::line!(), std::format!("Promise failed"), error.into());
                None
            },
        }
    }
}


pub mod state;
pub mod browser;
pub mod colors;

pub mod styles {
    use lazy_static::lazy_static;
    use dominator::{class, HIGHEST_ZINDEX};

    lazy_static! {
        pub static ref ROW_STYLE: String = class! {
            .style("display", "flex")
            .style("flex-direction", "row")
            .style("align-items", "center") // TODO get rid of this ?
        };

        pub static ref COLUMN_STYLE: String = class! {
            .style("display", "flex")
            .style("flex-direction", "column")
            .style("align-items", "stretch") // TODO get rid of this ?
        };

        pub static ref WRAP_STYLE: String = class! {
            .style("flex-wrap", "wrap")
        };

        pub static ref STRETCH_STYLE: String = class! {
            .style("flex-shrink", "1")
            .style("flex-grow", "1")
            .style("flex-basis", "0%")
        };

        pub static ref TOP_STYLE: String = class! {
            .style("white-space", "pre")
            .style("width", "100%")
            .style("height", "100%")
            .style("overflow", "hidden")

            .style_signal("color", crate::theme_color(crate::colors::tab_text))
            .style_signal("background-color", crate::theme_color(crate::colors::tab_background))
        };

        pub static ref MODAL_STYLE: String = class! {
            .style("position", "fixed")
            .style("left", "0px")
            .style("top", "0px")
            .style("width", "100%")
            .style("height", "100%")
        };

        pub static ref LOADING_STYLE: String = class! {
            .style("z-index", HIGHEST_ZINDEX)
            .style("color", "white")
            .style("font-weight", "bold")
            .style("font-size", "20px")
            .style("letter-spacing", "5px")
            .style("text-shadow", "1px 1px 1px black, 0px 0px 1px black")
        };

        pub static ref CENTER_STYLE: String = class! {
            .style("display", "flex")
            .style("flex-direction", "row")
            .style("align-items", "center")
            .style("justify-content", "center")
        };
    }
}


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
    lazy_static! {
        static ref EASING: easing::CubicBezier = easing::CubicBezier::new(0.66, 0.0, 0.34, 1.0);
        //static ref EASING: easing::CubicBezier = easing::CubicBezier::new(0.85, 0.0, 0.15, 1.0);
        //static ref EASING: easing::CubicBezier = easing::CubicBezier::new(1.0, 0.0, 0.66, 0.66);
    }

    EASING.easing(t)

    //easing::in_out(t, |t| EASING.easing(t))
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


thread_local! {
    static WINDOW: Window = window().unwrap();
}

pub fn confirm(message: &str) -> bool {
    WINDOW.with(|w| w.confirm_with_message(message)).unwrap()
}


#[inline]
pub fn performance_now() -> f64 {
    thread_local! {
        static PERFORMANCE: Performance = WINDOW.with(|w| w.performance()).unwrap();
    }

    PERFORMANCE.with(|a| a.now())
}

#[macro_export]
macro_rules! time {
    ($name:expr, $value:expr) => {{
        let old = $crate::performance_now();
        let value = $value;
        let new = $crate::performance_now();
        $crate::info!("{} took {}ms", $name, new - old);
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
        $crate::log(std::format!("[{}:{}]  {}", std::file!(), std::line!(), std::format!($($args)*)));
    };
}

#[inline]
pub fn log(s: String) {
    web_sys::console::log_1(&wasm_bindgen::JsValue::from(s));
}


#[macro_export]
macro_rules! warn {
    ($($args:tt)*) => {
        $crate::warn(std::format!("[{}:{}]  {}", std::file!(), std::line!(), std::format!($($args)*)));
    };
}

#[inline]
pub fn warn(s: String) {
    web_sys::console::warn_1(&wasm_bindgen::JsValue::from(s));
}


pub fn panic_hook(info: &std::panic::PanicInfo) {
    error!("{}", info.to_string());
    console_error_panic_hook::hook(info);
}


#[macro_export]
macro_rules! error {
    ($($args:tt)*) => {{
        let error = js_sys::Error::new("");
        $crate::error($crate::pretty_time(), std::file!(), std::line!(), std::format!($($args)*), error);
    }};
}

pub fn error(time: String, file: &'static str, line: u32, message: String, error: js_sys::Error) {
    let output = format!("{} [{}:{}] Error\n    {}\n>>> {}", time, file, line, message.replace("\n", "\n    "), error_message(&error).replace("\n", "\n    "));

    push_log(&output);
}


#[macro_export]
macro_rules! info {
    ($($args:tt)*) => {
        $crate::info($crate::pretty_time(), std::file!(), std::line!(), std::format!($($args)*));
    };
}

thread_local! {
    static LOGS: RefCell<Vec<String>> = RefCell::new(vec![]);
}

// TODO make this more efficient
pub fn info(time: String, file: &'static str, line: u32, message: String) {
    const MAX_LINES: usize = 100;

    // The 7 is the length of " [...] "
    // The 4 is the length of "    "
    const MAX_LINE_LENGTH: usize = 171 - 7 - 4;

    fn process_line(line: &str) -> String {
        // TODO make this more efficient
        let indexes: Vec<usize> = line.char_indices().map(|(index, _)| index).collect();
        let len = indexes.len();

        if len > MAX_LINE_LENGTH {
            let l = indexes[MAX_LINE_LENGTH / 2];
            let r = indexes[len - (MAX_LINE_LENGTH / 2)];
            format!("\n    {} [...] {}", &line[0..l], &line[r..])

        } else {
            format!("\n    {}", line)
        }
    }

    let mut output = format!("{} [{}:{}] Info", time, file, line);

    let lines: Vec<String> = message.lines().map(process_line).collect();

    if lines.len() > MAX_LINES {
        for line in &lines[0..(MAX_LINES / 2)] {
            output.push_str(line);
        }

        output.push_str("\n[...]");

        for line in &lines[lines.len() - (MAX_LINES / 2)..] {
            output.push_str(line);
        }

    } else {
        output.extend(lines);
    }

    push_log(&output);
}


pub fn export_function<A>(name: &str, f: Closure<A>) where A: wasm_bindgen::closure::WasmClosure + ?Sized {
    WINDOW.with(|w| {
        js_sys::Reflect::set(&w, &JsValue::from(name), f.as_ref()).unwrap();
    });
    f.forget();
}


#[macro_export]
macro_rules! closure {
    (move || -> $ret:ty $body:block) => {
        wasm_bindgen::closure::Closure::wrap(std::boxed::Box::new(move || -> $ret { $body }) as std::boxed::Box<dyn FnMut() -> $ret>)
    };
    (move |$($arg:ident: $type:ty),*| -> $ret:ty $body:block) => {
        wasm_bindgen::closure::Closure::wrap(std::boxed::Box::new(move |$($arg: $type),*| -> $ret { $body }) as std::boxed::Box<dyn FnMut($($type),*) -> $ret>)
    };
    (move || $body:block) => {
        $crate::closure!(move || -> () $body)
    };
    (move |$($arg:ident: $type:ty),*| $body:block) => {
        $crate::closure!(move |$($arg: $type),*| -> () $body)
    };
}


// TODO better logging of the error
fn print_error(e: &JsValue) {
    web_sys::console::error_1(&JsValue::from(error_message(&e)));
}


pub fn unwrap_future<F>(future: F) -> impl Future<Output = ()>
    where F: Future<Output = Result<(), JsValue>> {
    async {
        if let Err(e) = future.await {
            print_error(&e);
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

        static CRYPTO: web_sys::Crypto = WINDOW.with(|w| w.crypto().unwrap());
    }

    CRYPTO.with(|crypto| {
        UUID_ARRAY.with(|array| {
            crypto.get_random_values_with_array_buffer_view(&array).unwrap();

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
    static STORAGE: Storage = WINDOW.with(|w| w.local_storage().unwrap().unwrap());
}

pub fn local_storage_get(key: &str) -> Option<String> {
    STORAGE.with(|x| x.get_item(key).unwrap())
}

pub fn local_storage_set(key: &str, value: &str) {
    STORAGE.with(|x| x.set_item(key, value).unwrap())
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
    // This is needed because some URLs are malformed
    // TODO replace /%(?![0-9a-fA-F][0-9a-fA-F])/ with %25
    match js_sys::decode_uri_component(&input) {
        Ok(s) => s.into(),
        Err(_) => input.to_string(),
    }
}


pub fn window_width() -> f64 {
    WINDOW.with(|w| w.inner_width().unwrap().as_f64().unwrap())
}

pub fn window_height() -> f64 {
    WINDOW.with(|w| w.inner_height().unwrap().as_f64().unwrap())
}


pub struct Listener<A> where A: ?Sized {
    target: web_extension::Event,
    closure: Option<Closure<A>>,
}

impl<A> Listener<A> where A: ?Sized {
    pub fn new(target: web_extension::Event, closure: Closure<A>) -> Self {
        target.add_listener(closure.as_ref().unchecked_ref());
        Self { target, closure: Some(closure) }
    }
}

impl<A> Listener<A> where A: ?Sized + wasm_bindgen::closure::WasmClosure {
    pub fn forget(mut self) {
        self.closure.take().unwrap().forget();
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
    serde_json::to_string(value).unwrap()
}

pub fn serialize<A>(value: &A) -> JsValue where A: Serialize {
    JsValue::from(serialize_str(value))
}


pub fn deserialize_str<A>(value: &str) -> A where A: DeserializeOwned {
    serde_json::from_str(&value).unwrap()
}

pub fn deserialize<A>(value: &JsValue) -> A where A: DeserializeOwned {
    let value = value.as_string().unwrap();
    deserialize_str(&value)
}


// This guarantees that we will only be writing to the database one at a time.
// It also batches changes so it doesn't need to write to the database as often.
#[derive(Debug)]
struct DatabaseFlusher {
    // TODO realloc the changes occasionally ?
    changes: Vec<Change>,
    waiting: bool,
}

impl DatabaseFlusher {
    fn new() -> Self {
        Self {
            changes: vec![],
            waiting: false,
        }
    }

    fn flush(this: Rc<RefCell<Self>>) {
        let start_merge = performance_now();

        let mut updated = None;
        let mut removed = None;

        let len = {
            let mut lock = this.borrow_mut();

            let len = lock.changes.len();

            {
                let seen = Set::new(&JsValue::null());

                let mut iter = lock.changes.drain(..);

                while let Some(change) = iter.next_back() {
                    match change {
                        Change::Remove(key) => {
                            // If we have not seen the key yet...
                            if !seen.has(&key) {
                                seen.add(&key);
                                removed.get_or_insert_with(|| Array::new()).push(&key);
                            }
                        },
                        Change::Set(key, value) => {
                            // If we have not seen the key yet...
                            if !seen.has(&key) {
                                seen.add(&key);
                                Reflect::set(updated.get_or_insert_with(|| Object::new()), &key, &value).unwrap();
                            }
                        },
                    }
                }
            }

            assert_eq!(lock.changes.len(), 0);
            assert!(updated.is_some() || removed.is_some());

            len
        };

        let start_flush = performance_now();

        spawn(async move {
            try_join!(
                async move {
                    if let Some(updated) = updated {
                        let _ = JsFuture::from(browser.storage().local().set(&updated)).await?;
                    }

                    Ok(()) as Result<(), JsValue>
                },

                async move {
                    if let Some(removed) = removed {
                        let _ = JsFuture::from(browser.storage().local().remove(&removed)).await?;
                    }

                    Ok(()) as Result<(), JsValue>
                }
            )?;

            let end_flush = performance_now();

            info!("Flushing {} changes took {} ms", len, end_flush - start_flush);

            let should_flush = {
                let mut lock = this.borrow_mut();

                if lock.changes.is_empty() {
                    lock.waiting = false;
                    false

                } else {
                    true
                }
            };

            // More changes were queued while we were waiting
            if should_flush {
                Self::flush(this);
            }

            Ok(())
        });


        let end_merge = performance_now();

        info!("Merging {} changes took {} ms", len, end_merge - start_merge);
    }

    fn push_changes(this: &Rc<RefCell<Self>>, changes: &mut Vec<Change>) {
        let should_flush = {
            let mut lock = this.borrow_mut();

            lock.changes.append(changes);

            if !lock.waiting {
                lock.waiting = true;
                true

            } else {
                false
            }
        };

        if should_flush {
            Self::flush(this.clone());
        }
    }
}


#[derive(Debug)]
enum Change {
    Remove(JsValue),
    Set(JsValue, JsValue),
}

#[derive(Debug)]
struct TransactionState {
    // TODO verify that this doesn't leak
    flusher: Rc<RefCell<DatabaseFlusher>>,
    // TODO realloc the changes occasionally ?
    changes: Vec<Change>,
    is_delayed: bool,
    timer: Option<Timer>,
}

impl TransactionState {
    fn new(flusher: Rc<RefCell<DatabaseFlusher>>, is_delayed: bool) -> Rc<RefCell<Self>> {
        Rc::new(RefCell::new(Self {
            flusher,
            changes: vec![],
            is_delayed,
            timer: None,
        }))
    }

    // TODO use some sort of global lock to prevent out of order commits ?
    fn commit(&mut self) {
        self.is_delayed = false;
        self.timer = None;

        if !self.changes.is_empty() {
            DatabaseFlusher::push_changes(&self.flusher, &mut self.changes);
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
pub struct Database {
    db: Object,
    // TODO verify that this doesn't leak
    flusher: Rc<RefCell<DatabaseFlusher>>,
    // TODO verify that this doesn't leak
    state: Rc<RefCell<TransactionState>>,
    should_commit: bool,
}

impl Database {
    pub fn new() -> impl Future<Output = Result<Self, JsValue>> {
        // TODO move this inside the async ?
        let fut = JsFuture::from(browser.storage().local().get(&JsValue::null()));

        async move {
            let db = fut.await?;
            let db: Object = db.unchecked_into();
            Ok(Self::new_from_object_(db, true))
        }
    }

    fn new_from_object_(db: Object, should_commit: bool) -> Self {
        let flusher = Rc::new(RefCell::new(DatabaseFlusher::new()));

        Self {
            db,
            state: TransactionState::new(flusher.clone(), false),
            flusher,
            should_commit,
        }
    }

    pub fn new_from_object(db: Object) -> Self {
        Self::new_from_object_(db, false)
    }

    pub fn delay_commit(&mut self) {
        if self.should_commit {
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
                    self.state = TransactionState::new(self.flusher.clone(), true);
                }
            }

            self.state.borrow_mut().start_commit(&self.state);
        }
    }

    pub fn get_raw(&self, key: &str) -> Option<JsValue> {
        // TODO make this more efficient
        let key = JsValue::from(key);

        if Reflect::has(&self.db, &key).unwrap() {
            Some(Reflect::get(&self.db, &key).unwrap())

        } else {
            None
        }
    }

    pub fn set_raw(&self, key: &str, value: JsValue) {
        // TODO make this more efficient
        let key = JsValue::from(key);

        Reflect::set(&self.db, &key, &value).unwrap();

        if self.should_commit {
            let mut state = self.state.borrow_mut();

            state.changes.push(Change::Set(key, value));

            state.start_commit(&self.state);
        }
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
        Reflect::delete_property(&self.db, &key).unwrap();

        if self.should_commit {
            let mut state = self.state.borrow_mut();

            state.changes.push(Change::Remove(key));

            state.start_commit(&self.state);
        }
    }

    pub fn remove(&self, key: &str) {
        // TODO make this more efficient
        let key = JsValue::from(key);
        self.remove_raw(key);
    }

    pub fn clear(&self) {
        for key in Object::keys(&self.db).iter() {
            self.remove_raw(key);
        }
    }

    pub fn to_json(&self) -> String {
        js_sys::JSON::stringify_with_replacer_and_space(&self.db, &JsValue::UNDEFINED, &JsValue::from(2)).unwrap().into()
    }

    pub fn debug(&self) {
        web_sys::console::log_1(&self.db);
    }
}


#[wasm_bindgen]
extern "C" {
    #[derive(Debug)]
    type PortMessage;

    #[wasm_bindgen(method, getter)]
    fn data(this: &PortMessage) -> String;

    #[wasm_bindgen(method, getter)]
    fn done(this: &PortMessage) -> bool;
}


#[derive(Debug)]
pub struct Port<In, Out> {
    port: web_extension::Port,
    _input: std::marker::PhantomData<fn(In) -> JsValue>,
    _output: std::marker::PhantomData<fn(JsValue) -> Out>,
}

impl<In, Out> Port<In, Out> {
    #[inline]
    pub fn name(&self) -> String {
        self.port.name()
    }

    #[inline]
    pub fn send_message_str(&self, message: &str) {
        // 32 megabyte chunks
        const MAX_MESSAGE_LENGTH: usize = 33_554_432;

        let len = message.len();

        if len <= MAX_MESSAGE_LENGTH {
            self.port.post_message(&object! {
                "data": message,
                "done": true,
            }.into());

        // Send message in multiple chunks
        } else {
            let mut start = 0;

            loop {
                let mut end = start + MAX_MESSAGE_LENGTH;

                if end < len {
                    // Needed to prevent splitting in the middle of a char
                    while !message.is_char_boundary(end) {
                        end -= 1;
                    }

                    self.port.post_message(&object! {
                        "data": &message[start..end],
                        "done": false,
                    }.into());

                    start = end;

                } else {
                    self.port.post_message(&object! {
                        "data": &message[start..len],
                        "done": true,
                    }.into());

                    break;
                }
            }
        }
    }
}

impl<In, Out> Port<In, Out> where In: Serialize {
    #[inline]
    pub fn send_message(&self, message: &In) {
        self.send_message_str(&serialize_str(message));
    }

    #[inline]
    pub fn disconnect(self) {
        self.port.disconnect();
    }
}


struct OnMessage<A> {
    _on_message: Listener<dyn FnMut(PortMessage)>,
    _on_disconnect: Listener<dyn FnMut(web_extension::Port)>,
    receiver: mpsc::UnboundedReceiver<String>,
    _output: std::marker::PhantomData<fn(String) -> A>,
}

impl<A> Unpin for OnMessage<A> {}

impl<A> Stream for OnMessage<A> where A: DeserializeOwned {
    type Item = A;

    #[inline]
    fn poll_next(mut self: std::pin::Pin<&mut Self>, cx: &mut std::task::Context) -> std::task::Poll<Option<Self::Item>> {
        Pin::new(&mut self.receiver).poll_next(cx).map(|option| option.map(|s| deserialize_str(&s)))
    }
}

impl<In, Out> Port<In, Out> where Out: DeserializeOwned {
    pub fn on_message(&self) -> impl Stream<Item = Out> {
        let (sender, receiver) = mpsc::unbounded();

        let mut partial: Option<String> = None;

        let _on_message = Listener::new(self.port.on_message(), clone!(sender => Closure::new(move |message: PortMessage| {
            if message.done() {
                if let Some(mut part) = partial.take() {
                    part.push_str(&message.data());

                    sender.unbounded_send(part).unwrap();

                } else {
                    sender.unbounded_send(message.data()).unwrap();
                }

            } else {
                if let Some(part) = &mut partial {
                    part.push_str(&message.data());

                } else {
                    partial = Some(message.data());
                }
            }
        })));

        // TODO check port error ?
        let _on_disconnect = Listener::new(self.port.on_disconnect(), Closure::new(move |_| {
            sender.close_channel();
        }));

        OnMessage {
            _on_message,
            _on_disconnect,
            receiver,
            _output: std::marker::PhantomData,
        }
    }
}


struct OnConnect<In, Out> {
    _listener: Listener<dyn FnMut(web_extension::Port)>,
    receiver: mpsc::UnboundedReceiver<web_extension::Port>,
    _port: std::marker::PhantomData<fn(web_extension::Port) -> Port<In, Out>>,
}

impl<In, Out> Unpin for OnConnect<In, Out> {}

impl<In, Out> Stream for OnConnect<In, Out> {
    type Item = Port<In, Out>;

    #[inline]
    fn poll_next(mut self: std::pin::Pin<&mut Self>, cx: &mut std::task::Context) -> std::task::Poll<Option<Self::Item>> {
        std::pin::Pin::new(&mut self.receiver).poll_next(cx).map(|option| {
            option.map(|port| {
                Port {
                    port,
                    _input: std::marker::PhantomData,
                    _output: std::marker::PhantomData,
                }
            })
        })
    }
}

pub fn on_connect<In, Out>(name: &str) -> impl Stream<Item = Port<In, Out>> {
    let name = name.to_owned();

    let (sender, receiver) = mpsc::unbounded();

    let _listener = Listener::new(browser.runtime().on_connect(), Closure::new(move |port: web_extension::Port| {
        if port.name() == name {
            sender.unbounded_send(port).unwrap();
        }
    }));

    OnConnect {
        _listener,
        receiver,
        _port: std::marker::PhantomData,
    }
}


pub fn connect<In, Out>(name: &str) -> Port<In, Out> {
    Port {
        port: browser.runtime().connect(None, &object! {
            "name": name,
        }),
        _input: std::marker::PhantomData,
        _output: std::marker::PhantomData,
    }
}


struct Theme {
    mutable: Mutable<Option<web_extension::Theme>>,
    _listener: Listener<dyn FnMut(web_extension::ThemeUpdateInfo)>,
}


thread_local! {
    // TODO cleanup when all the signals are done
    static THEME: Theme = {
        let mutable = Mutable::new(None);

        spawn_local(clone!(mutable => async move {
            let current = JsFuture::from(browser.theme().get_current(None)).await.unwrap();
            let current = current.unchecked_into::<web_extension::Theme>();

            mutable.set(Some(current));
        }));

        Theme {
            _listener: Listener::new(
                browser.theme().on_updated(),
                clone!(mutable => closure!(move |info: web_extension::ThemeUpdateInfo| {
                    let mut lock = mutable.lock_mut();

                    // This makes sure that it only sets it after get_current
                    if lock.is_some() {
                        // TODO only set it for the current window ?
                        // TODO only set it if window_id is None ?
                        *lock = Some(info.theme());
                    }
                })),
            ),
            mutable,
        }
    };
}

pub fn theme() -> impl Signal<Item = Option<web_extension::Theme>> {
    THEME.with(|theme| theme.mutable.signal_cloned())
}

pub fn theme_color<F>(mut f: F) -> impl Signal<Item = String>
    where F: FnMut(Option<web_extension::ThemeColors>, ColorScheme) -> String {

    map_ref! {
        let theme = theme(),
        let scheme = color_scheme() => move {
            f(theme.as_ref().and_then(|theme| theme.colors()), *scheme)
        }
    }
}


#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ColorScheme {
    Light,
    Dark,
}

impl ColorScheme {
    fn from_bool(matches: bool) -> Self {
        if matches {
            Self::Dark
        } else {
            Self::Light
        }
    }

    pub fn defaults(self, light: String, dark: String) -> String {
        match self {
            Self::Light => light,
            Self::Dark => dark,
        }
    }
}

pub fn color_scheme() -> impl Signal<Item = ColorScheme> {
    struct ColorListener {
        mutable: Mutable<ColorScheme>,
        _listener: gloo_events::EventListener,
    }

    thread_local! {
        // TODO cleanup when all the signals are done
        static COLOR_LISTENER: ColorListener = {
            let query_list = WINDOW.with(|w| w.match_media("(prefers-color-scheme: dark)").unwrap().unwrap());

            let mutable = Mutable::new(ColorScheme::from_bool(query_list.matches()));

            let listener = gloo_events::EventListener::new(&query_list, "change", clone!(mutable => move |event| {
                let event: &web_sys::MediaQueryListEvent = event.unchecked_ref();

                mutable.set_neq(ColorScheme::from_bool(event.matches()));
            }));

            ColorListener { mutable, _listener: listener }
        };
    }

    COLOR_LISTENER.with(|x| x.mutable.signal())
}


/*pub fn on_message<S, D, P, F>(mut f: F) -> Listener<dyn FnMut(String, JsValue, JsValue) -> Promise>
    where D: DeserializeOwned,
          S: Serialize,
          P: Future<Output = Result<S, JsValue>> + 'static,
          F: FnMut(D) -> P + 'static {

    Listener::new(browser.runtime().on_message(), Closure::new(move |message: String, _: JsValue, _: JsValue| {
        let message: D = serde_json::from_str(&message).unwrap();
        let future = f(message);
        future_to_promise(async move {
            let reply = future.await?;
            let reply = serde_json::to_string(&reply).unwrap();
            Ok(JsValue::from(reply))
        })
    }))
}


pub fn send_message<A, B>(message: &A) -> impl Future<Output = Result<B, JsValue>>
    where A: Serialize,
          B: DeserializeOwned {
    let message = serialize(message);

    // TODO should this be inside the async ?
    let fut = JsFuture::from(browser.runtime().send_message(None, &message, None));

    async move {
        let reply = fut.await?;
        Ok(deserialize(&reply))
    }
}*/


#[macro_export]
macro_rules! array {
    ($($value:expr),*) => {{
        let array: js_sys::Array = js_sys::Array::new();
        $(array.push(&wasm_bindgen::JsValue::from($value));)*
        array
    }};
}

#[macro_export]
macro_rules! object {
    ($($key:literal: $value:expr,)*) => {{
        let obj: js_sys::Object = js_sys::Object::new();
        // TODO make this more efficient
        $(wasm_bindgen::UnwrapThrowExt::unwrap_throw(js_sys::Reflect::set(
            &obj,
            &wasm_bindgen::JsValue::from(wasm_bindgen::intern($key)),
            &wasm_bindgen::JsValue::from($value),
        ));)*
        obj
    }};
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


fn pretty_time_raw(x: &Date) -> String {
    format!("{:0>2}:{:0>2}:{:0>2}.{:0>3}", x.get_hours(), x.get_minutes(), x.get_seconds(), x.get_milliseconds())
}

pub fn pretty_date() -> String {
    let x = Date::new_0();
    format!("{}-{:0>2}-{:0>2} {}", x.get_full_year(), x.get_month() + 1, x.get_date(), pretty_time_raw(&x).replace(":", "."))
}

pub fn pretty_time() -> String {
    let x = Date::new_0();
    pretty_time_raw(&x)
}


pub fn round_to_hour(time: f64) -> f64 {
    // TODO direct f64 bindings for Date
    let t = Date::new(&JsValue::from(time));
    t.set_minutes(0);
    t.set_seconds(0);
    t.set_milliseconds(0);
    t.get_time()
}


pub fn round_to_day(time: f64) -> f64 {
    // TODO direct f64 bindings for Date
    let t = Date::new(&JsValue::from(time));
    t.set_hours(0);
    t.set_minutes(0);
    t.set_seconds(0);
    t.set_milliseconds(0);
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
            "Today".to_string()
            //"Less than an hour ago".to_string()

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

        let id = WINDOW.with(|w| {
            w.set_timeout_with_callback_and_timeout_and_arguments_0(
                closure.as_ref().unchecked_ref(),
                // TODO is this conversion correct ?
                ms as i32,
            )
            .unwrap()
        });

        Self { closure: Some(closure), id }
    }

    pub fn forget(mut self) {
        self.closure.take().unwrap().forget();
    }
}

impl Drop for Timer {
    fn drop(&mut self) {
        if let Some(_) = self.closure {
            WINDOW.with(|w| w.clear_timeout_with_handle(self.id));
        }
    }
}


pub fn set_interval<F>(f: F, ms: u32) where F: FnMut() + 'static {
    let f = Closure::wrap(Box::new(f) as Box<dyn FnMut()>);

    WINDOW.with(|w| {
        w.set_interval_with_callback_and_timeout_and_arguments_0(
            f.as_ref().unchecked_ref(),
            // TODO is this conversion correct ?
            ms as i32,
        )
        .unwrap()
    });

    f.forget();
}


// TODO make this more efficient ?
pub fn every_hour<F>(mut f: F) where F: FnMut() + 'static {
    // TODO is this okay ?
    const EXTRA_TIME_MARGIN: f64 = 100.0;

    let now = Date::now();
    let next = round_to_hour(now) + TimeDifference::HOUR;
    assert!(next > now);

    let diff = ((next - now) + EXTRA_TIME_MARGIN).ceil() as u32;

    assert!(diff > 0);

    Timer::new(diff, move || {
        assert!(Date::now() >= next);
        f();
        every_hour(f);
    }).forget();
}



#[derive(Debug)]
pub struct MultiSender<A> {
    sender: Rc<RefCell<Option<oneshot::Sender<A>>>>,
}

impl<A> MultiSender<A> {
    pub fn new(sender: oneshot::Sender<A>) -> Self {
        Self {
            sender: Rc::new(RefCell::new(Some(sender))),
        }
    }

    pub fn send(&self, value: A) {
        let _ = self.sender.borrow_mut()
            .take()
            .unwrap()
            .send(value);
    }
}

impl<A> Clone for MultiSender<A> {
    fn clone(&self) -> Self {
        Self {
            sender: self.sender.clone(),
        }
    }
}


struct ReadFile {
    reader: FileReader,
    receiver: oneshot::Receiver<Result<String, JsValue>>,
    _onabort: Closure<dyn FnMut(&JsValue)>,
    _onerror: Closure<dyn FnMut(&JsValue)>,
    _onload: Closure<dyn FnMut(&JsValue)>,
}

impl Future for ReadFile {
    type Output = Result<String, JsValue>;

    #[inline]
    fn poll(mut self: Pin<&mut Self>, cx: &mut Context) -> Poll<Self::Output> {
        Pin::new(&mut self.receiver).poll(cx).map(|x| {
            // TODO better error handling
            match x {
                Ok(x) => x,
                Err(_) => unreachable!(),
            }
        })
    }
}

impl Drop for ReadFile {
    // TODO test whether this triggers the abort event or not
    #[inline]
    fn drop(&mut self) {
        self.reader.abort();
    }
}

pub fn read_file(blob: &Blob) -> impl Future<Output = Result<String, JsValue>> {
    let (sender, receiver) = oneshot::channel();

    let sender = MultiSender::new(sender);

    let reader = FileReader::new().unwrap();

    let onabort = {
        let sender = sender.clone();

        Closure::once(move |_event: &JsValue| {
            sender.send(Err(Error::new("read_file was aborted").into()));
        })
    };

    let onerror = {
        let reader = reader.clone();
        let sender = sender.clone();

        Closure::once(move |_event: &JsValue| {
            sender.send(Err(reader.error().unwrap().into()));
        })
    };

    let onload = {
        let reader = reader.clone();

        Closure::once(move |_event: &JsValue| {
            sender.send(Ok(reader.result().unwrap().as_string().unwrap()));
        })
    };

    reader.set_onabort(Some(onabort.as_ref().unchecked_ref()));
    reader.set_onerror(Some(onerror.as_ref().unchecked_ref()));
    reader.set_onload(Some(onload.as_ref().unchecked_ref()));

    reader.read_as_text(blob).unwrap();

    ReadFile {
        reader,
        receiver,
        _onabort: onabort,
        _onerror: onerror,
        _onload: onload,
    }
}
