use wasm_bindgen::prelude::*;
use crate::Event;


// TODO
#[wasm_bindgen]
extern "C" {
    pub type BrowserAction;

    #[wasm_bindgen(method, getter, js_name = onClicked)]
    pub fn on_clicked(this: &BrowserAction) -> Event;
}
