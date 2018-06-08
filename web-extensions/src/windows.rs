use stdweb;
use stdweb::{Value, Reference, PromiseFuture};
use stdweb::private::ConversionError;
use stdweb::unstable::{TryInto, TryFrom};


#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct WindowId(u32);

impl TryFrom<Value> for WindowId {
    type Error = ConversionError;

    fn try_from(value: Value) -> Result<Self, Self::Error> {
        Ok(WindowId(value.try_into()?))
    }
}

impl WindowId {
    fn is_none(&self) -> bool {
        js!( return @{self.0} === browser.windows.WINDOW_ID_NONE ).try_into().unwrap()
    }

    fn as_option(self) -> Option<Self> {
        if self.is_none() {
            None

        } else {
            Some(self)
        }
    }
}


#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct TabId(u32);

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct CookieId(String);


pub enum WindowState {
    Normal,
    Minimized,
    Maximized,
    Fullscreen,
    Docked,
}

enum_boilerplate! { WindowState,
    "normal" => Normal,
    "minimized" => Minimized,
    "maximized" => Maximized,
    "fullscreen" => Fullscreen,
    "docked" => Docked,
}


pub enum WindowKind {
    Normal,
    Popup,
    Panel,
    DevTools,
}

enum_boilerplate! { WindowKind,
    "normal" => Normal,
    "popup" => Popup,
    "panel" => Panel,
    "devtools" => DevTools,
}


pub enum TabStatus {
    Loading,
    Complete,
}

enum_boilerplate! { TabStatus,
    "loading" => Loading,
    "complete" => Complete,
}


#[derive(Clone, Debug, PartialEq, Eq, ReferenceType)]
// TODO is this correct ?
#[reference(instance_of = "Object")]
pub struct Tab(Reference);

// TODO mutedInfo
impl Tab {
    pub fn id(&self) -> TabId {
        TabId(js!( return @{self}.id; ).try_into().unwrap())
    }

    pub fn window_id(&self) -> WindowId {
        WindowId(js!( return @{self}.windowId; ).try_into().unwrap())
    }

    pub fn opener_id(&self) -> Option<TabId> {
        let id: Option<u32> = js!( return @{self}.openerTabId; ).try_into().unwrap();
        id.map(TabId)
    }

    pub fn cookie_store_id(&self) -> Option<CookieId> {
        let id: Option<String> = js!( return @{self}.cookieStoreId; ).try_into().unwrap();
        id.map(CookieId)
    }

    pub fn is_focused(&self) -> bool {
        js!( return @{self}.active; ).try_into().unwrap()
    }

    pub fn is_audible(&self) -> bool {
        js!( return @{self}.audible; ).try_into().unwrap()
    }

    pub fn is_auto_discardable(&self) -> bool {
        js!( return @{self}.autoDiscardable; ).try_into().unwrap()
    }

    pub fn is_discarded(&self) -> bool {
        js!( return @{self}.discarded; ).try_into().unwrap()
    }

    pub fn is_hidden(&self) -> bool {
        js!( return @{self}.hidden; ).try_into().unwrap()
    }

    pub fn is_highlighted(&self) -> bool {
        js!( return @{self}.highlighted; ).try_into().unwrap()
    }

    pub fn is_incognito(&self) -> bool {
        js!( return @{self}.incognito; ).try_into().unwrap()
    }

    pub fn is_article(&self) -> bool {
        js!( return @{self}.isArticle; ).try_into().unwrap()
    }

    pub fn is_in_reader_mode(&self) -> bool {
        js!( return @{self}.isInReaderMode; ).try_into().unwrap()
    }

    pub fn is_pinned(&self) -> bool {
        js!( return @{self}.pinned; ).try_into().unwrap()
    }

    pub fn index(&self) -> u32 {
        js!( return @{self}.index; ).try_into().unwrap()
    }

    pub fn last_accessed(&self) -> f64 {
        js!( return @{self}.lastAccessed; ).try_into().unwrap()
    }

    pub fn favicon_url(&self) -> Option<String> {
        js!( return @{self}.favIconUrl; ).try_into().unwrap()
    }

    pub fn title(&self) -> Option<String> {
        js!( return @{self}.title; ).try_into().unwrap()
    }

    pub fn url(&self) -> Option<String> {
        js!( return @{self}.url; ).try_into().unwrap()
    }

    pub fn status(&self) -> TabStatus {
        js!( return @{self}.status; ).try_into().unwrap()
    }

    pub fn width(&self) -> f64 {
        js!( return @{self}.width; ).try_into().unwrap()
    }

    pub fn height(&self) -> f64 {
        js!( return @{self}.height; ).try_into().unwrap()
    }

    pub fn get_persistent_data(id: TabId, key: &str) -> PromiseFuture<Option<String>> {
        js!(
            return browser.sessions.getTabValue(@{id.0}, @{key});
        ).try_into().unwrap()
    }

    pub fn remove_persistent_data(id: TabId, key: &str) -> PromiseFuture<()> {
        js!(
            return browser.sessions.removeTabValue(@{id.0}, @{key});
        ).try_into().unwrap()
    }

    pub fn set_persistent_data(id: TabId, key: &str, value: &str) -> PromiseFuture<()> {
        js!(
            return browser.sessions.setTabValue(@{id.0}, @{key}, @{value});
        ).try_into().unwrap()
    }
}


#[derive(Clone, Debug, PartialEq, Eq, ReferenceType)]
// TODO is this correct ?
#[reference(instance_of = "Object")]
pub struct Window(Reference);

impl Window {
    pub fn id(&self) -> WindowId {
        WindowId(js!( return @{self}.id; ).try_into().unwrap())
    }

    pub fn is_incognito(&self) -> bool {
        js!( return @{self}.incognito; ).try_into().unwrap()
    }

    pub fn is_always_on_top(&self) -> bool {
        js!( return @{self}.alwaysOnTop; ).try_into().unwrap()
    }

    pub fn is_focused(&self) -> bool {
        js!( return @{self}.focused; ).try_into().unwrap()
    }

    pub fn title(&self) -> Option<String> {
        js!( return @{self}.title; ).try_into().unwrap()
    }

    pub fn kind(&self) -> WindowKind {
        js!( return @{self}.type; ).try_into().unwrap()
    }

    pub fn state(&self) -> WindowState {
        js!( return @{self}.state; ).try_into().unwrap()
    }

    pub fn tabs(&self) -> Option<Vec<Tab>> {
        js!( return @{self}.tabs; ).try_into().unwrap()
    }

    // TODO maybe return i32 ?
    pub fn left(&self) -> f64 {
        js!( return @{self}.left; ).try_into().unwrap()
    }

    // TODO maybe return i32 ?
    pub fn top(&self) -> f64 {
        js!( return @{self}.top; ).try_into().unwrap()
    }

    // TODO maybe return u32 ?
    pub fn width(&self) -> f64 {
        js!( return @{self}.width; ).try_into().unwrap()
    }

    // TODO maybe return u32 ?
    pub fn height(&self) -> f64 {
        js!( return @{self}.height; ).try_into().unwrap()
    }

    pub fn get_persistent_data(id: WindowId, key: &str) -> PromiseFuture<Option<String>> {
        js!(
            return browser.sessions.getWindowValue(@{id.0}, @{key});
        ).try_into().unwrap()
    }

    pub fn remove_persistent_data(id: WindowId, key: &str) -> PromiseFuture<()> {
        js!(
            return browser.sessions.removeWindowValue(@{id.0}, @{key});
        ).try_into().unwrap()
    }

    pub fn set_persistent_data(id: WindowId, key: &str, value: &str) -> PromiseFuture<()> {
        js!(
            return browser.sessions.setWindowValue(@{id.0}, @{key}, @{value});
        ).try_into().unwrap()
    }
}


pub fn get_all<'a, A: IntoIterator<Item = &'a WindowKind>>(has_tabs: bool, window_kinds: A) -> PromiseFuture<Vec<Window>> {
    // TODO make this more efficient ?
    let window_kinds: Vec<&str> = window_kinds.into_iter().map(|x| x.into_js_string()).collect();

    js!(
        return browser.windows.getAll({
            populate: @{has_tabs},
            windowTypes: @{window_kinds}
        });
    ).try_into().unwrap()
}


pub mod events {
    use super::{Window, WindowId};
    use stdweb::Value;


    pub struct Listener {
        on_drop: Value,
    }

    impl Listener {
        fn new(on_drop: Value) -> Self {
            Self { on_drop }
        }
    }

    impl Drop for Listener {
        fn drop(&mut self) {
            js! { @(no_return) @{&self.on_drop}(); }
        }
    }


    macro_rules! listener {
        ($callback:expr, $($name:tt)+) => {
            Listener::new(js!(
                var callback = @{$callback};

                $($name)+.addListener(callback);

                return function () {
                    $($name)+.removeListener(callback);
                };
            ))
        }
    }


    pub fn on_window_created<F>(f: F) -> Listener where F: FnMut(Window) + 'static {
        listener!(f, browser.windows.onCreated)
    }

    pub fn on_window_removed<F>(f: F) -> Listener where F: FnMut(WindowId) + 'static {
        listener!(f, browser.windows.onRemoved)
    }

    pub fn on_window_focus_changed<F>(mut f: F) -> Listener where F: FnMut(Option<WindowId>) + 'static {
        listener!(move |id: WindowId| f(id.as_option()), browser.windows.onFocusChanged)
    }


    /*pub fn stream() -> Stream {
        let (sender, receiver) = unbounded();

        Stream {
            receiver,
            on_window_created: on_window_created()
        }
    }*/
}
