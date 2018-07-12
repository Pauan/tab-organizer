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

use std::fmt;
use stdweb::{PromiseFuture, JsSerialize, Reference};
use stdweb::web::event::{IEvent, IUiEvent, ConcreteEvent};
use stdweb::unstable::TryInto;
use futures_signals::signal::{Signal, SignalExt};
use futures::future::IntoFuture;
use futures::FutureExt;
use uuid::Uuid;

pub mod state;


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
        static ref UUID_ARRAY: Reference = js!( return new Uint8Array(16); ).try_into().unwrap();
    }

    js!(
        var array = @{&*UUID_ARRAY};
        crypto.getRandomValues(array);
        return array;
    ).try_into().unwrap()
}

pub fn generate_uuid() -> Uuid {
    // TODO a little gross
    let mut bytes = [0; 16];
    bytes.copy_from_slice(&generate_random_bytes());
    Uuid::from_random_bytes(bytes)
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
