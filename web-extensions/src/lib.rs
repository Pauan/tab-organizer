use wasm_bindgen::prelude::*;
use js_sys::Function;

pub mod storage;
pub mod tabs;
pub mod windows;
pub mod session;


// TODO getRules, removeRules, and addRules
#[wasm_bindgen]
extern "C" {
    pub type Listener;

    #[wasm_bindgen(method, js_name = addListener)]
    pub fn add_listener(this: &Listener, callback: &Function);

    #[wasm_bindgen(method, js_name = removeListener)]
    pub fn remove_listener(this: &Listener, callback: &Function);

    #[wasm_bindgen(method, js_name = hasListener)]
    pub fn has_listener(this: &Listener, callback: &Function) -> bool;

    #[wasm_bindgen(method, js_name = hasListeners)]
    pub fn has_listeners(this: &Listener) -> bool;
}


pub mod traits {
    pub use crate::storage::{StorageAreaRead, StorageAreaWrite};
}
