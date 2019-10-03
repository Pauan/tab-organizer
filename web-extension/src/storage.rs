use wasm_bindgen::prelude::*;
use js_sys::{Object, Promise};
use crate::Listener;


#[wasm_bindgen]
extern "C" {
    pub type StorageAreaRead;

    #[wasm_bindgen(method, js_name = "getBytesInUse")]
    pub fn get_bytes_in_use(this: &StorageAreaRead, keys: &JsValue) -> Promise;

    #[wasm_bindgen(method)]
    pub fn get(this: &StorageAreaRead, keys: &JsValue) -> Promise;
}

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(extends = StorageAreaRead)]
    pub type StorageAreaWrite;

    #[wasm_bindgen(method)]
    pub fn set(this: &StorageAreaWrite, keys: &Object) -> Promise;

    #[wasm_bindgen(method)]
    pub fn remove(this: &StorageAreaWrite, keys: &JsValue) -> Promise;

    #[wasm_bindgen(method)]
    pub fn clear(this: &StorageAreaWrite) -> Promise;
}

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(extends = StorageAreaWrite)]
    pub type Sync;

    #[wasm_bindgen(extends = StorageAreaWrite)]
    pub type Local;

    #[wasm_bindgen(extends = StorageAreaRead)]
    pub type Managed;
}

#[wasm_bindgen]
extern "C" {
    pub type Storage;

    #[wasm_bindgen(method, getter)]
    pub fn sync(this: &Storage) -> Sync;

    #[wasm_bindgen(method, getter)]
    pub fn local(this: &Storage) -> Local;

    #[wasm_bindgen(method, getter)]
    pub fn managed(this: &Storage) -> Managed;

    #[wasm_bindgen(method, getter, js_name = onChanged)]
    pub fn on_changed(this: &Storage) -> Listener;
}

#[wasm_bindgen]
extern "C" {
    pub type StorageChange;

    #[wasm_bindgen(method, getter, js_name = oldValue)]
    pub fn old_value(this: &StorageChange) -> JsValue;

    #[wasm_bindgen(method, getter, js_name = newValue)]
    pub fn new_value(this: &StorageChange) -> JsValue;
}
