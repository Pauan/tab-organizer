#![warn(unreachable_pub)]

use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use web_extension::browser;
use wasm_bindgen_futures::futures_0_3::JsFuture;
use tab_organizer::{spawn, log};


#[wasm_bindgen(start)]
pub fn main_js() {
    #[cfg(debug_assertions)]
    std::panic::set_hook(Box::new(console_error_panic_hook::hook));

    let cb = Closure::wrap(Box::new(move |_| {
        let promise = browser.sidebar_action().open();

    	spawn(async move {
    		let _ = JsFuture::from(promise).await?;
    		Ok(())
    	});
    }) as Box<dyn FnMut(JsValue)>);

    browser.browser_action().on_clicked().add_listener(cb.as_ref().unchecked_ref());

    cb.forget();

    log!("Backrgound page started");
}
