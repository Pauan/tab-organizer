#[macro_use]
extern crate lazy_static;
#[macro_use]
extern crate stdweb;
#[macro_use]
extern crate serde_derive;
#[macro_use]
extern crate futures_signals;
extern crate futures;
extern crate uuid;
extern crate web_extensions;

use stdweb::{PromiseFuture, JsSerialize, Reference};
use stdweb::unstable::TryInto;
use futures_signals::signal::{Signal, SignalExt};
use futures::future::IntoFuture;
use futures::FutureExt;
use uuid::Uuid;

pub mod state;


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
