#![warn(unreachable_pub)]

use wasm_bindgen::prelude::*;
use tab_organizer::{log};


#[wasm_bindgen(start)]
pub fn main_js() -> Result<(), JsValue> {
    std::panic::set_hook(Box::new(console_error_panic_hook::hook));


    log!("Starting");


    log!("Options page started");
    Ok(())
}
