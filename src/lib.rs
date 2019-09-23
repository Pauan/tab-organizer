#![warn(unreachable_pub)]

use std::borrow::Borrow;
use std::sync::Arc;
use futures_signals::signal::{Signal, SignalExt};
use std::future::Future;
use dominator::RefFn;
use dominator::animation::{easing, Percentage};
use uuid::Uuid;
use js_sys::Date;
use web_sys::{window, Performance, Storage};
use wasm_bindgen_futures::futures_0_3::spawn_local;
use wasm_bindgen::JsCast;
use wasm_bindgen::prelude::*;


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


pub fn set_timeout<F>(f: F, ms: u32) where F: FnOnce() + 'static {
    let f = Closure::once_into_js(f);

    window()
        .unwrap_throw()
        .set_timeout_with_callback_and_timeout_and_arguments_0(
            f.unchecked_ref(),
            // TODO is this conversion correct ?
            ms as i32,
        )
        .unwrap_throw();
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

    set_timeout(move || {
        assert!(Date::now() >= next);
        f();
        every_hour(f);
    // TODO is this correct ?
    }, (next - now).ceil() as u32);
}
