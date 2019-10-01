use wasm_bindgen::prelude::*;
use js_sys::Function;

mod storage;
pub use storage::*;

mod tabs;
pub use tabs::*;

mod windows;
pub use windows::*;

mod session;
pub use session::*;

mod sidebar_action;
pub use sidebar_action::*;

mod browser_action;
pub use browser_action::*;


#[wasm_bindgen]
extern "C" {
    pub type Browser;

    pub static browser: Browser;

    #[wasm_bindgen(method, getter, js_name = sidebarAction)]
    pub fn sidebar_action(this: &Browser) -> SidebarAction;

    #[wasm_bindgen(method, getter, js_name = browserAction)]
    pub fn browser_action(this: &Browser) -> BrowserAction;
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
