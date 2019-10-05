use wasm_bindgen::prelude::*;
use js_sys::Function;

mod storage;
pub use storage::*;

mod tabs;
pub use tabs::*;

mod windows;
pub use windows::*;

mod sessions;
pub use sessions::*;

mod sidebar_action;
pub use sidebar_action::*;

mod browser_action;
pub use browser_action::*;

mod runtime;
pub use runtime::*;

mod port;
pub use port::*;


#[wasm_bindgen]
extern "C" {
    pub type Browser;

    pub static browser: Browser;

    #[wasm_bindgen(method, getter, js_name = sidebarAction)]
    pub fn sidebar_action(this: &Browser) -> SidebarAction;

    #[wasm_bindgen(method, getter, js_name = browserAction)]
    pub fn browser_action(this: &Browser) -> BrowserAction;

    #[wasm_bindgen(method, getter)]
    pub fn runtime(this: &Browser) -> Runtime;

    #[wasm_bindgen(method, getter)]
    pub fn storage(this: &Browser) -> Storage;

    #[wasm_bindgen(method, getter)]
    pub fn windows(this: &Browser) -> Windows;

    #[wasm_bindgen(method, getter)]
    pub fn tabs(this: &Browser) -> Tabs;

    #[wasm_bindgen(method, getter)]
    pub fn sessions(this: &Browser) -> Sessions;
}


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
