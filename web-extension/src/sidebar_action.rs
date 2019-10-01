use wasm_bindgen::prelude::*;
use js_sys::Promise;


// TODO
#[wasm_bindgen]
extern "C" {
    pub type SidebarAction;

    #[wasm_bindgen(method)]
    pub fn open(this: &SidebarAction) -> Promise;
}
