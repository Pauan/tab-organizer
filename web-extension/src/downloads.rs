use wasm_bindgen::prelude::*;
use js_sys::{Object, Promise};


// TODO other methods
#[wasm_bindgen]
extern "C" {
    pub type Downloads;

    #[wasm_bindgen(method)]
    pub fn download(this: &Downloads, info: &Object) -> Promise;
}
