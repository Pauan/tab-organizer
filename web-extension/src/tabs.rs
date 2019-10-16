use wasm_bindgen::prelude::*;
use js_sys::{Object, Promise};
use crate::Listener;


#[wasm_bindgen]
extern "C" {
    #[derive(Debug)]
    pub type TabActiveInfo;

    #[wasm_bindgen(method, getter, js_name = previousTabId)]
    pub fn previous_tab_id(this: &TabActiveInfo) -> Option<i32>;

    #[wasm_bindgen(method, getter, js_name = tabId)]
    pub fn tab_id(this: &TabActiveInfo) -> i32;

    #[wasm_bindgen(method, getter, js_name = windowId)]
    pub fn window_id(this: &TabActiveInfo) -> i32;
}


#[wasm_bindgen]
extern "C" {
    #[derive(Debug)]
    pub type TabDetachInfo;

    #[wasm_bindgen(method, getter, js_name = oldWindowId)]
    pub fn old_window_id(this: &TabDetachInfo) -> i32;

    #[wasm_bindgen(method, getter, js_name = oldPosition)]
    pub fn old_position(this: &TabDetachInfo) -> u32;
}


#[wasm_bindgen]
extern "C" {
    #[derive(Debug)]
    pub type TabAttachInfo;

    #[wasm_bindgen(method, getter, js_name = newWindowId)]
    pub fn new_window_id(this: &TabAttachInfo) -> i32;

    #[wasm_bindgen(method, getter, js_name = newPosition)]
    pub fn new_position(this: &TabAttachInfo) -> u32;
}


#[wasm_bindgen]
extern "C" {
    #[derive(Debug)]
    pub type TabMoveInfo;

    #[wasm_bindgen(method, getter, js_name = windowId)]
    pub fn window_id(this: &TabMoveInfo) -> i32;

    #[wasm_bindgen(method, getter, js_name = fromIndex)]
    pub fn from_index(this: &TabMoveInfo) -> u32;

    #[wasm_bindgen(method, getter, js_name = toIndex)]
    pub fn to_index(this: &TabMoveInfo) -> u32;
}


#[wasm_bindgen]
extern "C" {
    #[derive(Debug)]
    pub type TabRemoveInfo;

    #[wasm_bindgen(method, getter, js_name = windowId)]
    pub fn window_id(this: &TabRemoveInfo) -> i32;

    #[wasm_bindgen(method, getter, js_name = isWindowClosing)]
    pub fn is_window_closing(this: &TabRemoveInfo) -> bool;
}


#[wasm_bindgen]
extern "C" {
    #[derive(Debug)]
    pub type TabMutedInfo;

    #[wasm_bindgen(method, getter)]
    pub fn muted(this: &TabMutedInfo) -> bool;

    #[wasm_bindgen(method, getter, js_name = extensionId)]
    pub fn extension_id(this: &TabMutedInfo) -> Option<String>;

    #[wasm_bindgen(method, getter)]
    pub fn reason(this: &TabMutedInfo) -> Option<String>;
}


#[wasm_bindgen]
extern "C" {
    #[derive(Debug, Clone)]
    pub type Tab;

    #[wasm_bindgen(method, getter)]
    pub fn active(this: &Tab) -> bool;

    #[wasm_bindgen(method, getter)]
    pub fn hidden(this: &Tab) -> bool;

    #[wasm_bindgen(method, getter)]
    pub fn incognito(this: &Tab) -> bool;

    #[wasm_bindgen(method, getter)]
    pub fn pinned(this: &Tab) -> bool;

    #[wasm_bindgen(method, getter)]
    pub fn highlighted(this: &Tab) -> bool;

    #[wasm_bindgen(method, getter, js_name = isArticle)]
    pub fn is_article(this: &Tab) -> bool;

    #[wasm_bindgen(method, getter, js_name = isInReaderMode)]
    pub fn is_in_reader_mode(this: &Tab) -> bool;

    #[wasm_bindgen(method, getter, js_name = lastAccessed)]
    pub fn last_accessed(this: &Tab) -> f64;

    #[wasm_bindgen(method, getter)]
    pub fn attention(this: &Tab) -> Option<bool>;

    #[wasm_bindgen(method, getter)]
    pub fn audible(this: &Tab) -> Option<bool>;

    #[wasm_bindgen(method, getter)]
    pub fn discarded(this: &Tab) -> Option<bool>;

    #[wasm_bindgen(method, getter, js_name = autoDiscardable)]
    pub fn auto_discardable(this: &Tab) -> Option<bool>;

    #[wasm_bindgen(method, getter, js_name = cookieStoreId)]
    pub fn cookie_store_id(this: &Tab) -> Option<String>;

    #[wasm_bindgen(method, getter, js_name = favIconUrl)]
    pub fn fav_icon_url(this: &Tab) -> Option<String>;

    #[wasm_bindgen(method, getter)]
    // TODO is u32 correct ?
    pub fn width(this: &Tab) -> Option<u32>;

    #[wasm_bindgen(method, getter)]
    // TODO is u32 correct ?
    pub fn height(this: &Tab) -> Option<u32>;

    #[wasm_bindgen(method, getter)]
    // TODO is i32 correct ?
    pub fn id(this: &Tab) -> Option<i32>;

    #[wasm_bindgen(method, getter, js_name = openerTabId)]
    // TODO is i32 correct ?
    pub fn opener_tab_id(this: &Tab) -> Option<i32>;

    #[wasm_bindgen(method, getter, js_name = successorId)]
    // TODO is i32 correct ?
    pub fn successor_id(this: &Tab) -> Option<i32>;

    #[wasm_bindgen(method, getter)]
    pub fn index(this: &Tab) -> u32;

    #[wasm_bindgen(method, getter, js_name = mutedInfo)]
    pub fn muted_info(this: &Tab) -> TabMutedInfo;

    #[wasm_bindgen(method, getter, js_name = sessionId)]
    pub fn session_id(this: &Tab) -> Option<String>;

    #[wasm_bindgen(method, getter)]
    pub fn status(this: &Tab) -> Option<String>;

    #[wasm_bindgen(method, getter)]
    pub fn title(this: &Tab) -> Option<String>;

    #[wasm_bindgen(method, getter)]
    pub fn url(this: &Tab) -> Option<String>;

    #[wasm_bindgen(method, getter, js_name = windowId)]
    pub fn window_id(this: &Tab) -> i32;
}


#[wasm_bindgen]
extern "C" {
    pub type Tabs;

    #[wasm_bindgen(method, getter, js_name = TAB_ID_NONE)]
    pub fn tab_id_none(this: &Tabs) -> i32;

    #[wasm_bindgen(method, js_name = captureTab)]
    pub fn capture_tab(this: &Tabs, tab_id: Option<i32>, info: Option<&Object>) -> Promise;

    #[wasm_bindgen(method, js_name = captureVisibleTab)]
    pub fn capture_visible_tab(this: &Tabs, window_id: Option<i32>, info: Option<&Object>) -> Promise;

    #[wasm_bindgen(method)]
    pub fn connect(this: &Tabs, tab_id: i32, info: Option<&Object>) -> Promise;

    #[wasm_bindgen(method)]
    pub fn create(this: &Tabs, info: &Object) -> Promise;

    #[wasm_bindgen(method)]
    pub fn discard(this: &Tabs, tab_ids: &JsValue) -> Promise;

    #[wasm_bindgen(method)]
    pub fn duplicate(this: &Tabs, tab_id: i32) -> Promise;

    #[wasm_bindgen(method, js_name = executeScript)]
    pub fn execute_script(this: &Tabs, tab_id: Option<i32>, info: &Object) -> Promise;

    #[wasm_bindgen(method)]
    pub fn get(this: &Tabs, tab_id: i32) -> Promise;

    #[wasm_bindgen(method, js_name = getCurrent)]
    pub fn get_current(this: &Tabs) -> Promise;

    #[wasm_bindgen(method, js_name = getZoom)]
    pub fn get_zoom(this: &Tabs, tab_id: Option<i32>) -> Promise;

    #[wasm_bindgen(method, js_name = getZoomSettings)]
    pub fn get_zoom_settings(this: &Tabs, tab_id: Option<i32>) -> Promise;

    #[wasm_bindgen(method)]
    pub fn hide(this: &Tabs, tab_ids: &JsValue) -> Promise;

    #[wasm_bindgen(method)]
    pub fn highlight(this: &Tabs, info: &Object) -> Promise;

    #[wasm_bindgen(method, js_name = insertCSS)]
    pub fn insert_css(this: &Tabs, tab_id: Option<i32>, info: &Object) -> Promise;

    #[wasm_bindgen(method, js_name = move)]
    pub fn move_(this: &Tabs, tab_ids: &JsValue, info: &Object) -> Promise;

    #[wasm_bindgen(method, js_name = moveInSuccession)]
    pub fn move_in_succession(this: &Tabs, tab_ids: &JsValue, tab_id: Option<i32>, info: Option<&Object>) -> Promise;

    #[wasm_bindgen(method)]
    pub fn print(this: &Tabs);

    #[wasm_bindgen(method, js_name = printPreview)]
    pub fn print_preview(this: &Tabs) -> Promise;

    #[wasm_bindgen(method)]
    pub fn query(this: &Tabs, info: &Object) -> Promise;

    #[wasm_bindgen(method)]
    pub fn reload(this: &Tabs, tab_id: Option<i32>, info: Option<&Object>) -> Promise;

    #[wasm_bindgen(method)]
    pub fn remove(this: &Tabs, tab_ids: &JsValue) -> Promise;

    #[wasm_bindgen(method, js_name = removeCSS)]
    pub fn remove_css(this: &Tabs, tab_id: Option<i32>, info: &Object) -> Promise;

    #[wasm_bindgen(method, js_name = saveAsPDF)]
    pub fn save_as_pdf(this: &Tabs, info: &Object) -> Promise;

    #[wasm_bindgen(method, js_name = sendMessage)]
    pub fn send_message(this: &Tabs, tab_id: i32, message: &JsValue, info: Option<&Object>) -> Promise;

    #[wasm_bindgen(method, js_name = setZoom)]
    pub fn set_zoom(this: &Tabs, tab_id: Option<i32>, zoom_factor: f64) -> Promise;

    #[wasm_bindgen(method, js_name = setZoomSettings)]
    pub fn set_zoom_settings(this: &Tabs, tab_id: Option<i32>, info: &Object) -> Promise;

    #[wasm_bindgen(method)]
    pub fn show(this: &Tabs, tab_ids: &JsValue) -> Promise;

    #[wasm_bindgen(method, js_name = toggleReaderMode)]
    pub fn toggle_reader_mode(this: &Tabs, tab_id: Option<i32>) -> Promise;

    #[wasm_bindgen(method)]
    pub fn update(this: &Tabs, tab_id: Option<i32>, info: &Object) -> Promise;

    #[wasm_bindgen(method, js_name = detectLanguage)]
    pub fn detect_language(this: &Tabs, tab_id: Option<i32>) -> Promise;

    #[wasm_bindgen(method, getter, js_name = onActivated)]
    pub fn on_activated(this: &Tabs) -> Listener;

    #[wasm_bindgen(method, getter, js_name = onAttached)]
    pub fn on_attached(this: &Tabs) -> Listener;

    #[wasm_bindgen(method, getter, js_name = onCreated)]
    pub fn on_created(this: &Tabs) -> Listener;

    #[wasm_bindgen(method, getter, js_name = onDetached)]
    pub fn on_detached(this: &Tabs) -> Listener;

    #[wasm_bindgen(method, getter, js_name = onHighlighted)]
    pub fn on_highlighted(this: &Tabs) -> Listener;

    #[wasm_bindgen(method, getter, js_name = onMoved)]
    pub fn on_moved(this: &Tabs) -> Listener;

    #[wasm_bindgen(method, getter, js_name = onRemoved)]
    pub fn on_removed(this: &Tabs) -> Listener;

    #[wasm_bindgen(method, getter, js_name = onReplaced)]
    pub fn on_replaced(this: &Tabs) -> Listener;

    #[wasm_bindgen(method, getter, js_name = onUpdated)]
    pub fn on_updated(this: &Tabs) -> Listener;

    #[wasm_bindgen(method, getter, js_name = onZoomChanged)]
    pub fn on_zoom_changed(this: &Tabs) -> Listener;
}
