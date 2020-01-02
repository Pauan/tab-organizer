use wasm_bindgen::prelude::*;
use js_sys::{Object, Promise};
use crate::Event;
use crate::tabs::Tab;
use crate::windows::Window;


#[wasm_bindgen]
extern "C" {
    #[derive(Debug)]
    pub type Session;

    #[wasm_bindgen(method, getter, js_name = lastModified)]
    pub fn last_modified(this: &Session) -> f64;

    #[wasm_bindgen(method, getter)]
    pub fn tab(this: &Session) -> Option<Tab>;

    #[wasm_bindgen(method, getter)]
    pub fn window(this: &Session) -> Option<Window>;
}


#[wasm_bindgen]
extern "C" {
    pub type Sessions;

    #[wasm_bindgen(method, getter, js_name = MAX_SESSION_RESULTS)]
    // TODO is u32 correct ?
    pub fn max_session_results(this: &Sessions) -> u32;

    #[wasm_bindgen(method, js_name = forgetClosedTab)]
    pub fn forget_closed_tab(this: &Sessions, window_id: i32, session_id: &str) -> Promise;

    #[wasm_bindgen(method, js_name = forgetClosedWindow)]
    pub fn forget_closed_window(this: &Sessions, session_id: &str) -> Promise;

    #[wasm_bindgen(method, js_name = getRecentlyClosed)]
    pub fn get_recently_closed(this: &Sessions, filter: Option<&Object>) -> Promise;

    #[wasm_bindgen(method)]
    pub fn restore(this: &Sessions, session_id: &str) -> Promise;

    #[wasm_bindgen(method, js_name = getTabValue)]
    pub fn get_tab_value(this: &Sessions, tab_id: i32, key: &str) -> Promise;

    #[wasm_bindgen(method, js_name = setTabValue)]
    pub fn set_tab_value(this: &Sessions, tab_id: i32, key: &str, value: &JsValue) -> Promise;

    #[wasm_bindgen(method, js_name = removeTabValue)]
    pub fn remove_tab_value(this: &Sessions, tab_id: i32, key: &str) -> Promise;

    #[wasm_bindgen(method, js_name = getWindowValue)]
    pub fn get_window_value(this: &Sessions, window_id: i32, key: &str) -> Promise;

    #[wasm_bindgen(method, js_name = setWindowValue)]
    pub fn set_window_value(this: &Sessions, window_id: i32, key: &str, value: &JsValue) -> Promise;

    #[wasm_bindgen(method, js_name = removeWindowValue)]
    pub fn remove_window_value(this: &Sessions, window_id: i32, key: &str) -> Promise;

    #[wasm_bindgen(method, getter, js_name = onChanged)]
    pub fn on_changed(this: &Sessions) -> Event;
}
