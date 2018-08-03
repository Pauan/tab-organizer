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
use stdweb::{PromiseFuture, JsSerialize, Reference};
use stdweb::web::{TypedArray, IHtmlElement};
use stdweb::web::event::{IEvent, IUiEvent, ConcreteEvent};
use stdweb::unstable::TryInto;
use futures_signals::signal::{IntoSignal, Signal, SignalExt};
use futures::future::IntoFuture;
use futures::FutureExt;
use dominator::{DerefFn, DomBuilder};
use dominator::animation::{easing, Percentage};
use uuid::Uuid;

pub mod state;


pub fn str_default<'a, A: Borrow<String>>(x: &'a Option<A>, default: &'a str) -> &'a str {
    x.as_ref().map(|x| x.borrow().as_str()).unwrap_or(default)
}

pub fn option_str(x: Option<Arc<String>>) -> Option<DerefFn<Arc<String>, impl Fn(&Arc<String>) -> &str>> {
    x.map(|x| DerefFn::new(x, move |x| x.as_str()))
}

pub fn option_str_default<A: Borrow<String>>(x: Option<A>, default: &'static str) -> DerefFn<Option<A>, impl Fn(&Option<A>) -> &str> {
    DerefFn::new(x, move |x| str_default(x, default))
}

pub fn option_str_default_fn<A, F>(x: Option<A>, default: &'static str, f: F) -> DerefFn<Option<A>, impl Fn(&Option<A>) -> &str> where F: Fn(&A) -> &Option<String> {
    DerefFn::new(x, move |x| {
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
pub fn visible<A, B>(signal: B) -> impl FnOnce(DomBuilder<A>) -> DomBuilder<A>
    where A: IHtmlElement + Clone + 'static,
          B: IntoSignal<Item = bool>,
          B::Signal: 'static {

    // TODO is this inline a good idea ?
    #[inline]
    move |dom| {
        dom.style_signal("display", signal.into_signal().map(|visible| {
            if visible {
                None

            } else {
                Some("none")
            }
        }))
    }
}

#[inline]
pub fn cursor<A, B>(is_dragging: A, cursor: &'static str) -> impl FnOnce(DomBuilder<B>) -> DomBuilder<B>
    where A: IntoSignal<Item = bool>,
          A::Signal: 'static,
          B: IHtmlElement + Clone + 'static {

    // TODO is this inline a good idea ?
    #[inline]
    move |dom| {
        dom.style_signal("cursor", is_dragging.into_signal().map(move |is_dragging| {
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


pub fn spawn<A>(future: A)
    where A: IntoFuture<Item = ()>,
          A::Future: 'static,
          A::Error: JsSerialize + 'static {
    PromiseFuture::spawn_local(
        future.into_future().map_err(PromiseFuture::print_error_panic)
    )
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


// TODO only poll right if left is false
pub fn or<A, B>(left: A, right: B) -> impl Signal<Item = bool>
    where A: Signal<Item = bool>,
          B: Signal<Item = bool> {
    map_ref! {
        let left = left,
        let right = right =>
        *left || *right
    }
}

// TODO only poll right if left is true
pub fn and<A, B>(left: A, right: B) -> impl Signal<Item = bool>
    where A: Signal<Item = bool>,
          B: Signal<Item = bool> {
    map_ref! {
        let left = left,
        let right = right =>
        *left && *right
    }
}

pub fn not<A>(signal: A) -> impl Signal<Item = bool> where A: Signal<Item = bool> {
    signal.map(|x| !x)
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
