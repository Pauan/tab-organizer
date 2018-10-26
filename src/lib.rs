#![feature(futures_api)]
#![warn(unreachable_pub)]

#[macro_use]
extern crate lazy_static;
#[macro_use]
extern crate stdweb;
// TODO remove this
#[macro_use]
extern crate stdweb_derive;
#[macro_use]
extern crate serde_derive;
#[macro_use]
extern crate futures_signals;
extern crate futures;
extern crate uuid;
extern crate web_extensions;
extern crate dominator;

use std::fmt;
use std::borrow::Borrow;
use std::sync::Arc;
use std::cmp::Ordering;
use stdweb::{spawn_local, unwrap_future, JsSerialize, Reference, Once};
use stdweb::web::{TypedArray, IHtmlElement, Date};
use stdweb::web::event::{IEvent, IUiEvent, ConcreteEvent};
use stdweb::unstable::TryInto;
use futures_signals::signal::{Signal, SignalExt};
use futures::Future;
use dominator::{RefFn, DomBuilder};
use dominator::animation::{easing, Percentage};
use uuid::Uuid;

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

#[inline]
pub fn cursor<A, B>(is_dragging: A, cursor: &'static str) -> impl FnOnce(DomBuilder<B>) -> DomBuilder<B>
    where A: Signal<Item = bool> + 'static,
          B: IHtmlElement + Clone + 'static {

    // TODO is this inline a good idea ?
    #[inline]
    move |dom| {
        dom.style_signal("cursor", is_dragging.map(move |is_dragging| {
            if is_dragging {
                None

            } else {
                Some(cursor)
            }
        }))
    }
}

pub fn none_if<A, F>(signal: A, none_if: f64, mut f: F, min: f64, max: f64) -> impl Signal<Item = Option<String>>
    where A: Signal<Item = Percentage>,
          F: FnMut(Percentage, f64, f64) -> String {
    signal.map(move |t| t.none_if(none_if).map(|t| f(ease(t), min, max)))
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
    js!( return performance.now(); ).try_into().unwrap()
}

#[macro_export]
macro_rules! time {
    ($name:expr, $value:expr) => {{
        let old = $crate::performance_now();
        let value = $value;
        let new = $crate::performance_now();
        log!("{} took {}ms", $name, new - old);
        value
    }}
}


#[macro_export]
macro_rules! log {
    ($($args:tt)*) => {
        js! { @(no_return)
            console.log(@{format!($($args)*)});
        }
    };
}


pub fn spawn<A, B>(future: A)
    where A: Future<Output = Result<(), B>> + 'static,
          B: JsSerialize {
    spawn_local(unwrap_future(future))
}


// TODO verify that this is cryptographically secure
// TODO add in [u8; 16] implementations for TryFrom<Value>
fn generate_random_bytes() -> Vec<u8> {
    // TODO maybe this lazy_static doesn't actually help performance ?
    lazy_static! {
        static ref UUID_ARRAY: TypedArray<u8> = js!( return new Uint8Array(16); ).try_into().unwrap();
    }

    js! { @(no_return)
        crypto.getRandomValues(@{&*UUID_ARRAY});
    }

    UUID_ARRAY.to_vec()
}

pub fn generate_uuid() -> Uuid {
    // TODO a little gross
    let mut bytes = [0; 16];
    bytes.copy_from_slice(&generate_random_bytes());
    Uuid::from_random_bytes(bytes)
}


// TODO test this
pub fn get_len<A, F>(mut iter: A, mut f: F) -> usize where A: Iterator, F: FnMut(A::Item) -> bool {
    let mut len = 0;

    while let Some(x) = iter.next() {
        if f(x) {
            len += 1;
        }
    }

    len
}

// TODO test this
pub fn get_index<A, F>(mut iter: A, real_index: usize, mut f: F) -> usize where A: Iterator, F: FnMut(A::Item) -> bool {
    let mut index = 0;
    let mut len = 0;

    while let Some(x) = iter.next() {
        if f(x) {
            if index == real_index {
                return len;

            } else {
                index += 1;
            }
        }

        len += 1;
    }

    // TODO is this correct ?
    assert_eq!(index, real_index);
    len
}

// TODO test this
pub fn get_sorted_index<A, S>(mut iter: A, mut sort: S) -> Result<usize, usize>
    where A: Iterator,
          S: FnMut(A::Item) -> Option<Ordering> {

    let mut index = 0;

    while let Some(value) = iter.next() {
        match sort(value) {
            None | Some(Ordering::Less) => {},
            Some(Ordering::Equal) => {
                return Ok(index);
            },
            Some(Ordering::Greater) => {
                return Err(index);
            },
        }

        index += 1;
    }

    Err(index)
}


pub fn set_panic_hook<F>(hook: F) where F: Fn(String) + Send + Sync + 'static {
    std::panic::set_hook(Box::new(move |info| {
        hook(info.to_string());
    }));
}


pub fn decode_uri_component(input: &str) -> String {
    js!( return decodeURIComponent(@{input}); ).try_into().unwrap()
}


// TODO move this into stdweb
#[derive(Clone, Debug, PartialEq, Eq, ReferenceType)]
#[reference(instance_of = "UIEvent")] // TODO: Better type check.
//#[reference(subclass_of(Event, UiEvent))]
pub struct ScrollEvent(Reference);

impl IEvent for ScrollEvent {}
impl IUiEvent for ScrollEvent {}
impl ConcreteEvent for ScrollEvent {
    const EVENT_TYPE: &'static str = "scroll";
}


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
}


pub fn round_to_hour(time: f64) -> f64 {
    js!(
        var t = new Date(@{time});
        t.setUTCMinutes(0, 0, 0);
        return t.getTime();
    ).try_into().unwrap()
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


// TODO make this more efficient ?
pub fn every_hour<F>(mut f: F) where F: FnMut() + 'static {
    let now = Date::now();
    let next = round_to_hour(now) + TimeDifference::HOUR;
    assert!(next > now);

    let callback = move || {
        assert!(Date::now() >= next);
        f();
        every_hour(f);
    };

    js! { @(no_return)
        setTimeout(@{Once(callback)}, @{next - now});
    }
}
