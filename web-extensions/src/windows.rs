use stdweb;
use stdweb::{Reference, PromiseFuture};
use stdweb::unstable::TryInto;


pub struct Id(f64);

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


#[derive(Clone, Debug, PartialEq, Eq, ReferenceType)]
// TODO is this correct ?
#[reference(instance_of = "Object")]
pub struct Tab(Reference);


#[derive(Clone, Debug, PartialEq, Eq, ReferenceType)]
// TODO is this correct ?
#[reference(instance_of = "Object")]
pub struct Window(Reference);

impl Window {
    pub fn id(&self) -> Id {
        Id(js!( return @{self}.id; ).try_into().unwrap())
    }

    pub fn incognito(&self) -> bool {
        js!( return @{self}.incognito; ).try_into().unwrap()
    }

    pub fn always_on_top(&self) -> bool {
        js!( return @{self}.alwaysOnTop; ).try_into().unwrap()
    }

    pub fn focused(&self) -> bool {
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
