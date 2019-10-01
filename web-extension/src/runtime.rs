use wasm_bindgen::prelude::*;
use js_sys::{Object, Promise};
use crate::Listener;


// TODO
#[wasm_bindgen]
extern "C" {
    pub type Runtime;

    #[wasm_bindgen(method, js_name = sendMessage)]
    pub fn send_message(this: &Runtime, extension_id: Option<&str>, message: &JsValue, options: Option<&Object>) -> Promise;

    #[wasm_bindgen(method, getter, js_name = onMessage)]
    pub fn on_message(this: &Runtime) -> Listener;
}
