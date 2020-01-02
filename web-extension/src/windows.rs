use wasm_bindgen::prelude::*;
use js_sys::{Array, Object, Promise};
use crate::Event;


#[wasm_bindgen]
extern "C" {
    #[derive(Debug)]
    pub type Window;

    #[wasm_bindgen(method, getter, js_name = alwaysOnTop)]
    pub fn always_on_top(this: &Window) -> bool;

    #[wasm_bindgen(method, getter)]
    pub fn focused(this: &Window) -> bool;

    #[wasm_bindgen(method, getter)]
    pub fn incognito(this: &Window) -> bool;

    #[wasm_bindgen(method, getter)]
    // TODO is i32 correct ?
    pub fn left(this: &Window) -> Option<i32>;

    #[wasm_bindgen(method, getter)]
    // TODO is i32 correct ?
    pub fn top(this: &Window) -> Option<i32>;

    #[wasm_bindgen(method, getter)]
    // TODO is u32 correct ?
    pub fn width(this: &Window) -> Option<u32>;

    #[wasm_bindgen(method, getter)]
    // TODO is u32 correct ?
    pub fn height(this: &Window) -> Option<u32>;

    #[wasm_bindgen(method, getter)]
    // TODO is i32 correct ?
    pub fn id(this: &Window) -> Option<i32>;

    #[wasm_bindgen(method, getter, js_name = sessionId)]
    pub fn session_id(this: &Window) -> Option<String>;

    #[wasm_bindgen(method, getter)]
    pub fn title(this: &Window) -> Option<String>;

    #[wasm_bindgen(method, getter)]
    pub fn state(this: &Window) -> Option<String>;

    #[wasm_bindgen(method, getter)]
    pub fn tabs(this: &Window) -> Option<Array>;

    #[wasm_bindgen(method, getter, js_name = type)]
    pub fn type_(this: &Window) -> Option<String>;
}


#[wasm_bindgen]
extern "C" {
    pub type Windows;

    #[wasm_bindgen(method, getter, js_name = WINDOW_ID_NONE)]
    pub fn window_id_none(this: &Windows) -> i32;

    #[wasm_bindgen(method, getter, js_name = WINDOW_ID_CURRENT)]
    pub fn window_id_current(this: &Windows) -> i32;

    #[wasm_bindgen(method)]
    pub fn get(this: &Windows, window_id: i32, info: &Object) -> Promise;

    #[wasm_bindgen(method, js_name = getCurrent)]
    pub fn get_current(this: &Windows, info: &Object) -> Promise;

    #[wasm_bindgen(method, js_name = getLastFocused)]
    pub fn get_last_focused(this: &Windows, info: &Object) -> Promise;

    #[wasm_bindgen(method, js_name = getAll)]
    pub fn get_all(this: &Windows, info: &Object) -> Promise;

    #[wasm_bindgen(method)]
    pub fn create(this: &Windows, info: &Object) -> Promise;

    #[wasm_bindgen(method)]
    pub fn update(this: &Windows, window_id: i32, info: &Object) -> Promise;

    #[wasm_bindgen(method)]
    pub fn remove(this: &Windows, window_id: i32) -> Promise;

    #[wasm_bindgen(method, getter, js_name = onCreated)]
    pub fn on_created(this: &Windows) -> Event;

    #[wasm_bindgen(method, getter, js_name = onRemoved)]
    pub fn on_removed(this: &Windows) -> Event;

    #[wasm_bindgen(method, getter, js_name = onFocusChanged)]
    pub fn on_focus_changed(this: &Windows) -> Event;
}
