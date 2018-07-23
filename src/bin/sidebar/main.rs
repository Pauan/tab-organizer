#![recursion_limit="128"]
#![warn(unreachable_pub)]

extern crate uuid;
extern crate futures;
#[macro_use]
extern crate futures_signals;
#[macro_use]
extern crate dominator;
#[macro_use]
extern crate tab_organizer;
#[macro_use]
extern crate stdweb;
#[macro_use]
extern crate lazy_static;

use std::borrow::Borrow;
use std::sync::Arc;
use tab_organizer::{generate_uuid, and, or, not, ScrollEvent};
use tab_organizer::state as server;
use tab_organizer::state::{SidebarMessage, TabChange, Options, SortTabs};
use dominator::traits::*;
use dominator::{Dom, DomBuilder, text, text_signal, DerefFn};
use dominator::animation::{Percentage, MutableAnimation};
use dominator::animation::easing;
use dominator::events::{MouseDownEvent, MouseEnterEvent, InputEvent, MouseLeaveEvent, MouseMoveEvent, MouseUpEvent, MouseButton, IMouseEvent, ResizeEvent, ClickEvent};
use stdweb::PromiseFuture;
use stdweb::web::{Date, HtmlElement, IElement, IHtmlElement, set_timeout};
use stdweb::web::html_element::InputElement;
use futures_signals::signal::{Signal, IntoSignal, Mutable, SignalExt};
use futures_signals::signal_vec::SignalVecExt;

use group::Tab;
use state::{State, DragState};
use style::*;

mod parse;
mod waiter;
mod url_bar;
mod menu;
mod groups;
mod group;
mod state;
mod style;


const LOADING_MESSAGE_THRESHOLD: u32 = 500;

const MOUSE_SCROLL_THRESHOLD: f64 = 30.0; // Number of pixels before it starts scrolling
const MOUSE_SCROLL_SPEED: f64 = 0.5; // Number of pixels to move per millisecond

const INSERT_ANIMATION_DURATION: f64 = 800.0;
const DRAG_ANIMATION_DURATION: f64 = 100.0;
const SELECTED_TABS_ANIMATION_DURATION: f64 = 150.0;

const TAB_DRAGGING_THRESHOLD: f64 = 7.0; // Pixels the mouse has to move before dragging begins
const TAB_DRAGGING_TOP: i32 = 11;
const DRAG_GAP_PX: f64 = 32.0; // TODO adjust this based on how many tabs are being dragged
const INSERT_LEFT_MARGIN: f64 = 12.0;

const TOOLBAR_HEIGHT: f64 = 20.0;
const TOOLBAR_BORDER_WIDTH: f64 = 1.0;
const TOOLBAR_MARGIN: f64 = 2.0;
const TOOLBAR_TOTAL_HEIGHT: f64 = TOOLBAR_MARGIN + (TOOLBAR_BORDER_WIDTH * 2.0) + TOOLBAR_HEIGHT;

const GROUP_BORDER_WIDTH: f64 = 1.0;
const GROUP_PADDING_TOP: f64 = 3.0;
const GROUP_HEADER_HEIGHT: f64 = 16.0;
const GROUP_PADDING_BOTTOM: f64 = 3.0;

const TAB_BORDER_WIDTH: f64 = 1.0;
const TAB_PADDING: f64 = 1.0;
const TAB_HEIGHT: f64 = 16.0;
const TAB_FAVICON_SIZE: f64 = 16.0;
const TAB_CLOSE_BORDER_WIDTH: f64 = 1.0;
const TAB_TOTAL_HEIGHT: f64 = (TAB_BORDER_WIDTH * 2.0) + (TAB_PADDING * 2.0) + TAB_HEIGHT;


fn option_str(x: Option<Arc<String>>) -> Option<DerefFn<Arc<String>, impl Fn(&Arc<String>) -> &str>> {
    x.map(|x| DerefFn::new(x, move |x| x.as_str()))
}

fn option_str_default<A: Borrow<String>>(x: Option<A>, default: &'static str) -> DerefFn<Option<A>, impl Fn(&Option<A>) -> &str> {
    DerefFn::new(x, move |x| {
        x.as_ref().map(|x| x.borrow().as_str()).unwrap_or(default)
    })
}

fn option_str_default_fn<A, F>(x: Option<A>, default: &'static str, f: F) -> DerefFn<Option<A>, impl Fn(&Option<A>) -> &str> where F: Fn(&A) -> &Option<String> {
    DerefFn::new(x, move |x| {
        if let Some(x) = x {
            if let Some(x) = f(x) {
                x.as_str()

            } else {
                default
            }

        } else {
            default
        }
    })
}

fn is_empty<A: Borrow<String>>(input: &Option<A>) -> bool {
    input.as_ref().map(|x| x.borrow().len() == 0).unwrap_or(true)
}

fn px(t: f64) -> String {
    // TODO find which spots should be rounded and which shouldn't ?
    format!("{}px", t.round())
}

fn px_range(t: Percentage, min: f64, max: f64) -> String {
    px(t.range_inclusive(min, max))
}

fn float_range(t: Percentage, min: f64, max: f64) -> String {
    t.range_inclusive(min, max).to_string()
}

fn ease(t: Percentage) -> Percentage {
    easing::in_out(t, easing::cubic)
}

#[inline]
fn visible<A, B>(signal: B) -> impl FnOnce(DomBuilder<A>) -> DomBuilder<A>
    where A: IHtmlElement + Clone + 'static,
          B: IntoSignal<Item = bool>,
          B::Signal: 'static {

    // TODO is this inline a good idea ?
    #[inline]
    move |dom| {
        dom.style_signal("display", signal.into_signal().map(|visible| {
            if visible {
                None

            } else {
                Some("none")
            }
        }))
    }
}

#[inline]
fn cursor<A, B>(is_dragging: A, cursor: &'static str) -> impl FnOnce(DomBuilder<B>) -> DomBuilder<B>
    where A: IntoSignal<Item = bool>,
          A::Signal: 'static,
          B: IHtmlElement + Clone + 'static {

    // TODO is this inline a good idea ?
    #[inline]
    move |dom| {
        dom.style_signal("cursor", is_dragging.into_signal().map(move |is_dragging| {
            if is_dragging {
                None

            } else {
                Some(cursor)
            }
        }))
    }
}

fn none_if<A, F>(signal: A, none_if: f64, mut f: F, min: f64, max: f64) -> impl Signal<Item = Option<String>>
    where A: Signal<Item = Percentage>,
          F: FnMut(Percentage, f64, f64) -> String {
    signal.map(move |t| t.none_if(none_if).map(|t| f(ease(t), min, max)))
}


lazy_static! {
    static ref FAILED: Mutable<Option<Arc<String>>> = Mutable::new(None);

    static ref IS_LOADED: Mutable<bool> = Mutable::new(false);
}


fn initialize(state: Arc<State>) {
    fn make_url_bar_child<A, D, F>(state: &State, name: &str, mut display: D, f: F) -> Dom
        where A: IntoStr,
              D: FnMut(Arc<url_bar::UrlBar>) -> bool + 'static,
              F: FnMut(Option<Arc<url_bar::UrlBar>>) -> A + 'static {
        html!("div", {
            .class(&URL_BAR_TEXT_STYLE)
            .class(name)

            .mixin(visible(state.url_bar.signal_cloned().map(move |url_bar| {
                if let Some(url_bar) = url_bar {
                    display(url_bar)

                } else {
                    false
                }
            })))

            .children(&mut [
                text_signal(state.url_bar.signal_cloned().map(f))
            ])
        })
    }

    fn tab_favicon<A: Mixin<DomBuilder<HtmlElement>>>(tab: &Tab, mixin: A) -> Dom {
        html!("img", {
            .class(&TAB_FAVICON_STYLE)
            .class(&ICON_STYLE)

            .class_signal(&TAB_FAVICON_STYLE_UNLOADED, tab.unloaded.signal())

            .attribute_signal("src", tab.favicon_url.signal_cloned().map(option_str))

            .mixin(mixin)
        })
    }

    fn tab_text<A: Mixin<DomBuilder<HtmlElement>>>(tab: &Tab, mixin: A) -> Dom {
        html!("div", {
            .class(&STRETCH_STYLE)
            .class(&TAB_TEXT_STYLE)

            .children(&mut [
                text_signal(map_ref! {
                    let title = tab.title.signal_cloned(),
                    let unloaded = tab.unloaded.signal() => {
                        if *unloaded {
                            if title.is_some() {
                                "➔ "

                            } else {
                                "➔"
                            }

                        } else {
                            ""
                        }
                    }
                }),

                text_signal(tab.title.signal_cloned().map(|x| option_str_default(x, ""))),
            ])

            .mixin(mixin)
        })
    }

    fn tab_close<A: Mixin<DomBuilder<HtmlElement>>>(tab: &Tab, mixin: A) -> Dom {
        html!("img", {
            .class(&TAB_CLOSE_STYLE)
            .class(&ICON_STYLE)

            .attribute("src", "data/images/button-close.png")

            .mixin(mixin)
        })
    }

    fn tab_template<A>(state: &State, tab: &Tab, favicon: Dom, text: Dom, close: Dom, mixin: A) -> Dom
        where A: Mixin<DomBuilder<HtmlElement>> {

        html!("div", {
            .class(&ROW_STYLE)
            .class(&TAB_STYLE)
            .class(&MENU_ITEM_STYLE)

            .mixin(cursor(state.is_dragging(), "pointer"))

            .class_signal(&TAB_UNLOADED_STYLE, tab.unloaded.signal())
            .class_signal(&TAB_FOCUSED_STYLE, tab.is_focused())

            .children(&mut [favicon, text, close])

            .mixin(mixin)
        })
    }


    stylesheet!("html, body", {
        .style_signal("cursor", state.is_dragging().map(|is_dragging| {
            if is_dragging {
                Some("grabbing")

            } else {
                None
            }
        }))
    });

    dominator::append_dom(&dominator::body(),
        html!("div", {
            .class(&TOP_STYLE)
            .class(&TEXTURE_STYLE)

            // TODO only attach this when dragging
            .global_event(clone!(state => move |_: MouseUpEvent| {
                state.drag_end();
            }))

            // TODO only attach this when dragging
            .global_event(clone!(state => move |e: MouseMoveEvent| {
                state.drag_move(e.client_x(), e.client_y());
            }))

            .global_event(clone!(state => move |_: ResizeEvent| {
                state.update(false);
            }))

            .future(waiter::waiter(&state, clone!(state => move |should_search| {
                state.update(should_search);
            })))

            .children(&mut [
                html!("div", {
                    .class(&DRAGGING_STYLE)

                    .mixin(visible(state.is_dragging()))

                    .style_signal("width", state.dragging.state.signal_ref(|dragging| {
                        if let Some(DragState::Dragging { rect, .. }) = dragging {
                            Some(px(rect.get_width()))

                        } else {
                            None
                        }
                    }))

                    .style_signal("transform", state.dragging.state.signal_ref(|dragging| {
                        if let Some(DragState::Dragging { mouse_y, rect, .. }) = dragging {
                            Some(format!("translate({}px, {}px)", rect.get_left().round(), (mouse_y - TAB_DRAGGING_TOP)))

                        } else {
                            None
                        }
                    }))

                    .children_signal_vec(state.dragging.selected_tabs.signal_ref(clone!(state => move |tabs| {
                        tabs.iter().enumerate().map(|(index, tab)| {
                            // TODO use some sort of oneshot animation instead
                            // TODO don't create the animation at all for index 0
                            let animation = MutableAnimation::new(SELECTED_TABS_ANIMATION_DURATION);

                            if index > 0 {
                                animation.animate_to(Percentage::new(1.0));
                            }

                            Dom::with_state(animation, |animation| {
                                tab_template(&state, &tab,
                                    tab_favicon(&tab, |dom| dom),
                                    tab_text(&tab, |dom| dom),

                                    if index == 0 {
                                        tab_close(&tab, |dom| dom)

                                    } else {
                                        dominator::Dom::empty()
                                    },

                                    |mut dom: DomBuilder<HtmlElement>| {
                                        dom = dom
                                            .class_signal(&TAB_SELECTED_STYLE, tab.selected.signal())
                                            .class(&MENU_ITEM_SHADOW_STYLE)
                                            .style("z-index", &format!("-{}", index));

                                        if index == 0 {
                                            dom = dom
                                                .class(&TAB_HOVER_STYLE)
                                                .class(&MENU_ITEM_HOVER_STYLE)
                                                .class_signal(&TAB_SELECTED_HOVER_STYLE, tab.selected.signal())
                                                .class_signal(&TAB_UNLOADED_HOVER_STYLE, tab.unloaded.signal())
                                                .class_signal(&TAB_FOCUSED_HOVER_STYLE, tab.is_focused());
                                        }

                                        // TODO use ease-out easing
                                        if index > 0 && index < 5 {
                                            dom = dom.style_signal("margin-top", none_if(animation.signal(), 0.0, px_range, 0.0, -(TAB_TOTAL_HEIGHT - 2.0)));

                                        } else if index >= 5 {
                                            dom = dom.style_signal("margin-top", none_if(animation.signal(), 0.0, px_range, 0.0, -TAB_TOTAL_HEIGHT));
                                        }

                                        // TODO use ease-out easing
                                        if index >= 5 {
                                            dom = dom.style_signal("opacity", none_if(animation.signal(), 0.0, float_range, 1.0, 0.0));
                                        }

                                        dom
                                    })
                            })
                        }).collect()
                    })).to_signal_vec())
                }),

                html!("div", {
                    .class(&ROW_STYLE)
                    .class(&URL_BAR_STYLE)

                    .mixin(visible(map_ref! {
                        let is_dragging = state.is_dragging(),
                        let url_bar = state.url_bar.signal_cloned() => {
                            // TODO a bit hacky
                            let matches = url_bar.as_ref().map(|url_bar| {
                                !is_empty(&url_bar.protocol) ||
                                !is_empty(&url_bar.domain) ||
                                !is_empty(&url_bar.path) ||
                                !is_empty(&url_bar.file) ||
                                !is_empty(&url_bar.query) ||
                                !is_empty(&url_bar.hash)
                            }).unwrap_or(false);

                            !is_dragging && matches
                        }
                    }))

                    // TODO check if any of these need "flex-shrink": 1
                    .children(&mut [
                        make_url_bar_child(&state, &URL_BAR_PROTOCOL_STYLE, |x| !is_empty(&x.protocol), |url_bar| option_str_default_fn(url_bar, "", |x| &x.protocol)), // .as_ref().map(|x| x.as_str())
                        make_url_bar_child(&state, &URL_BAR_DOMAIN_STYLE, |x| !is_empty(&x.domain), |url_bar| option_str_default_fn(url_bar, "", |x| &x.domain)),
                        make_url_bar_child(&state, &URL_BAR_PATH_STYLE, |x| !is_empty(&x.path), |url_bar| option_str_default_fn(url_bar, "", |x| &x.path)),
                        make_url_bar_child(&state, &URL_BAR_FILE_STYLE, |x| !is_empty(&x.file), |url_bar| option_str_default_fn(url_bar, "", |x| &x.file)),
                        make_url_bar_child(&state, &URL_BAR_QUERY_STYLE, |x| !is_empty(&x.query), |url_bar| option_str_default_fn(url_bar, "", |x| &x.query)),
                        make_url_bar_child(&state, &URL_BAR_HASH_STYLE, |x| !is_empty(&x.hash), |url_bar| option_str_default_fn(url_bar, "", |x| &x.hash)),
                    ])
                }),

                html!("div", {
                    .class(&ROW_STYLE)
                    .class(&TOOLBAR_STYLE)

                    .children(&mut [
                        html!("input" => InputElement, {
                            .class(&SEARCH_STYLE)
                            .class(&STRETCH_STYLE)

                            .mixin(cursor(state.is_dragging(), "auto"))

                            .style_signal("background-color", FAILED.signal_cloned().map(|failed| {
                                if failed.is_some() {
                                    Some("hsl(5, 100%, 90%)")

                                } else {
                                    None
                                }
                            }))

                            .attribute("type", "text")
                            .attribute("autofocus", "")
                            .attribute("autocomplete", "off")
                            .attribute("placeholder", "Search")

                            .attribute_signal("title", FAILED.signal_cloned().map(|x| option_str_default(x, "")))

                            .attribute_signal("value", state.search_box.signal_cloned().map(|x| DerefFn::new(x, |x| x.as_str())))

                            .with_element(|dom, element: InputElement| {
                                dom.event(clone!(state => move |_: InputEvent| {
                                    let value = Arc::new(element.raw_value());
                                    stdweb::web::window().local_storage().insert("tab-organizer.search", &value).unwrap();
                                    state.search_parser.set(parse::Parsed::new(&value));
                                    state.search_box.set(value);
                                    state.update(true);
                                }))
                            })
                        }),

                        html!("div", {
                            .class(&TOOLBAR_SEPARATOR_STYLE)
                        }),

                        {
                            let hovering = Mutable::new(false);
                            let holding = Mutable::new(false);

                            html!("div", {
                                .class(&TOOLBAR_MENU_WRAPPER_STYLE)
                                .children(&mut [
                                    html!("div", {
                                        .class(&ROW_STYLE)
                                        .class(&TOOLBAR_MENU_STYLE)

                                        .mixin(cursor(state.is_dragging(), "pointer"))

                                        .class_signal(&TOOLBAR_MENU_HOLD_STYLE, and(hovering.signal(), holding.signal()))

                                        .event(clone!(hovering => move |_: MouseEnterEvent| {
                                            hovering.set_neq(true);
                                        }))

                                        .event(move |_: MouseLeaveEvent| {
                                            hovering.set_neq(false);
                                        })

                                        .event(clone!(holding => move |_: MouseDownEvent| {
                                            holding.set_neq(true);
                                        }))

                                        // TODO only attach this when holding
                                        .global_event(move |_: MouseUpEvent| {
                                            holding.set_neq(false);
                                        })

                                        .event(clone!(state => move |_: ClickEvent| {
                                            state.menu.show();
                                        }))

                                        .children(&mut [
                                            text("Menu"),
                                        ])
                                    }),

                                    state.menu.render(|menu| { menu
                                        .submenu("Sort tabs by...", |menu| { menu
                                            .option("Window", state.options.sort_tabs.signal_ref(|x| *x == SortTabs::Window), clone!(state => move || {
                                                state.options.sort_tabs.set_neq(SortTabs::Window);
                                            }))

                                            .option("Tag", state.options.sort_tabs.signal_ref(|x| *x == SortTabs::Tag), clone!(state => move || {
                                                state.options.sort_tabs.set_neq(SortTabs::Tag);
                                            }))

                                            .separator()

                                            .option("Time (focused)", state.options.sort_tabs.signal_ref(|x| *x == SortTabs::TimeFocused), clone!(state => move || {
                                                state.options.sort_tabs.set_neq(SortTabs::TimeFocused);
                                            }))

                                            .option("Time (created)", state.options.sort_tabs.signal_ref(|x| *x == SortTabs::TimeCreated), clone!(state => move || {
                                                state.options.sort_tabs.set_neq(SortTabs::TimeCreated);
                                            }))

                                            .separator()

                                            .option("URL", state.options.sort_tabs.signal_ref(|x| *x == SortTabs::Url), clone!(state => move || {
                                                state.options.sort_tabs.set_neq(SortTabs::Url);
                                            }))

                                            .option("Name", state.options.sort_tabs.signal_ref(|x| *x == SortTabs::Name), clone!(state => move || {
                                                state.options.sort_tabs.set_neq(SortTabs::Name);
                                            }))
                                        })

                                        .separator()

                                        .submenu("Foo", |menu| { menu
                                            .option("Bar", futures_signals::signal::always(true), || {})
                                            .option("Qux", futures_signals::signal::always(false), || {})
                                        })
                                    }),
                                ])
                            })
                        },
                    ])
                }),

                html!("div", {
                    .class(&GROUP_LIST_STYLE)

                    .with_element(|dom, element: HtmlElement| { dom
                        // TODO also update these when groups/tabs are added/removed ?
                        .event(clone!(state, element => move |_: ScrollEvent| {
                            if IS_LOADED.get() {
                                let local_storage = stdweb::web::window().local_storage();
                                let y = element.scroll_top();
                                // TODO is there a more efficient way of converting to a string ?
                                local_storage.insert("tab-organizer.scroll.y", &y.to_string()).unwrap();
                                state.scrolling.y.set_neq(y);
                                state.update(false);
                            }
                        }))

                        // TODO use set_scroll_top instead
                        .future(map_ref! {
                            let loaded = IS_LOADED.signal(),
                            let scroll_y = state.scrolling.y.signal() => {
                                if *loaded {
                                    Some(*scroll_y)

                                } else {
                                    None
                                }
                            }
                        // TODO super hacky, figure out a better way to keep the scroll_y in bounds
                        }.for_each(clone!(state => move |scroll_y| {
                            if let Some(scroll_y) = scroll_y {
                                let scroll_y = scroll_y.round();
                                let old_scroll_y = element.scroll_top();

                                if old_scroll_y != scroll_y {
                                    element.set_scroll_top(scroll_y);

                                    // TODO does this cause a reflow ?
                                    let new_scroll_y = element.scroll_top();

                                    if new_scroll_y != scroll_y {
                                        state.scrolling.y.set_neq(new_scroll_y);
                                    }

                                    state.update(false);
                                }
                            }

                            Ok(())
                        })))
                    })

                    .children(&mut [
                        // TODO this is pretty hacky, but I don't know a better way to make it work
                        html!("div", {
                            .class(&GROUP_LIST_CHILDREN_STYLE)

                            .style_signal("padding-top", state.groups_padding.signal().map(px))
                            .style_signal("height", state.scrolling.height.signal().map(px))

                            .children_signal_vec(state.groups.signal_vec_cloned().enumerate()
                                //.delay_remove(|(_, group)| waiter::delay_animation(&group.insert_animation, &group.visible))
                                .filter_signal_cloned(|(_, group)| group.visible.signal())
                                .map(clone!(state => move |(index, group)| {
                                    if let Some(index) = index.get() {
                                        if state.should_be_dragging_group(index) {
                                            group.drag_top.jump_to(Percentage::new(1.0));
                                        }
                                    }

                                    html!("div", {
                                        .class(&GROUP_STYLE)

                                        .style_signal("top", none_if(group.drag_top.signal(), 0.0, px_range, -1.0, DRAG_GAP_PX - 1.0))
                                        .style_signal("padding-bottom", none_if(group.drag_over.signal(), 0.0, px_range, 0.0, DRAG_GAP_PX))
                                        .style_signal("margin-bottom", none_if(group.drag_over.signal(), 0.0, px_range, 0.0, -DRAG_GAP_PX))

                                        .style_signal("padding-top", none_if(group.insert_animation.signal(), 1.0, px_range, 0.0, GROUP_PADDING_TOP))
                                        .style_signal("border-top-width", none_if(group.insert_animation.signal(), 1.0, px_range, 0.0, GROUP_BORDER_WIDTH))
                                        .style_signal("opacity", none_if(group.insert_animation.signal(), 1.0, float_range, 0.0, 1.0))

                                        .event(clone!(state, group, index => move |_: MouseEnterEvent| {
                                            if let Some(index) = index.get() {
                                                state.drag_over_group(group.clone(), index);
                                            }
                                        }))

                                        .children(&mut [
                                            if group.show_header {
                                                html!("div", {
                                                    .class(&ROW_STYLE)
                                                    .class(&GROUP_HEADER_STYLE)

                                                    .style_signal("height", none_if(group.insert_animation.signal(), 1.0, px_range, 0.0, GROUP_HEADER_HEIGHT))
                                                    .style_signal("margin-left", none_if(group.insert_animation.signal(), 1.0, px_range, INSERT_LEFT_MARGIN, 0.0))

                                                    .children(&mut [
                                                        html!("div", {
                                                            .class(&GROUP_HEADER_TEXT_STYLE)
                                                            .class(&STRETCH_STYLE)
                                                            .children(&mut [
                                                                text_signal(map_ref! {
                                                                        let name = group.name.signal_cloned(),
                                                                        let index = index.signal() => {
                                                                            // TODO improve the efficiency of this ?
                                                                            name.clone().or_else(|| {
                                                                                index.map(|index| Arc::new((index + 1).to_string()))
                                                                            })
                                                                        }
                                                                    }
                                                                    // This causes it to remember the previous value if it returns `None`
                                                                    // TODO dedicated method for this ?
                                                                    .filter_map(|x| x)
                                                                    .map(|x| option_str_default(x, ""))),
                                                            ])
                                                        }),
                                                    ])
                                                })

                                            } else {
                                                Dom::empty()
                                            },

                                            html!("div", {
                                                .class(&GROUP_TABS_STYLE)

                                                .style_signal("padding-top", group.tabs_padding.signal().map(px))
                                                .style_signal("padding-bottom", none_if(group.insert_animation.signal(), 1.0, px_range, 0.0, GROUP_PADDING_BOTTOM))

                                                .children_signal_vec(group.tabs.signal_vec_cloned().enumerate()
                                                    //.delay_remove(|(_, tab)| waiter::delay_animation(&tab.insert_animation, &tab.visible))
                                                    .filter_signal_cloned(|(_, tab)| tab.visible.signal())
                                                    .map(clone!(state => move |(index, tab)| {
                                                        if let Some(index) = index.get() {
                                                            if state.should_be_dragging_tab(group.id, index) {
                                                                tab.drag_over.jump_to(Percentage::new(1.0));
                                                            }
                                                        }

                                                        tab_template(&state, &tab,
                                                            tab_favicon(&tab, |dom: DomBuilder<HtmlElement>| { dom
                                                                .style_signal("height", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_FAVICON_SIZE))
                                                            }),

                                                            tab_text(&tab, |dom: DomBuilder<HtmlElement>| { dom }),

                                                            tab_close(&tab, |dom: DomBuilder<HtmlElement>| { dom
                                                                .class_signal(&TAB_CLOSE_HOVER_STYLE, tab.close_hovered.signal())
                                                                .class_signal(&TAB_CLOSE_HOLD_STYLE, and(tab.close_hovered.signal(), tab.close_holding.signal()))

                                                                .style_signal("height", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_FAVICON_SIZE))
                                                                .style_signal("border-top-width", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_CLOSE_BORDER_WIDTH))
                                                                .style_signal("border-bottom-width", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_CLOSE_BORDER_WIDTH))

                                                                .mixin(visible(state.is_tab_hovered(&tab)))

                                                                .event(clone!(tab => move |_: MouseEnterEvent| {
                                                                    tab.close_hovered.set_neq(true);
                                                                }))

                                                                .event(clone!(tab => move |_: MouseLeaveEvent| {
                                                                    tab.close_hovered.set_neq(false);
                                                                }))

                                                                .event(clone!(tab => move |_: MouseDownEvent| {
                                                                    tab.close_holding.set_neq(true);
                                                                }))

                                                                // TODO only attach this when hovering
                                                                .global_event(clone!(tab => move |_: MouseUpEvent| {
                                                                    tab.close_holding.set_neq(false);
                                                                }))
                                                            }),

                                                            |dom: DomBuilder<HtmlElement>| dom
                                                                .class_signal(&TAB_HOVER_STYLE, state.is_tab_hovered(&tab))
                                                                .class_signal(&MENU_ITEM_HOVER_STYLE, state.is_tab_hovered(&tab))
                                                                .class_signal(&TAB_UNLOADED_HOVER_STYLE, and(state.is_tab_hovered(&tab), tab.unloaded.signal()))
                                                                .class_signal(&TAB_FOCUSED_HOVER_STYLE, and(state.is_tab_hovered(&tab), tab.is_focused()))

                                                                .class_signal(&TAB_HOLD_STYLE, state.is_tab_holding(&tab))
                                                                .class_signal(&MENU_ITEM_HOLD_STYLE, state.is_tab_holding(&tab))

                                                                .class_signal(&TAB_SELECTED_STYLE, tab.selected.signal())
                                                                .class_signal(&TAB_SELECTED_HOVER_STYLE, and(state.is_tab_hovered(&tab), tab.selected.signal()))
                                                                .class_signal(&MENU_ITEM_SHADOW_STYLE, or(state.is_tab_hovered(&tab), tab.selected.signal()))

                                                                .attribute_signal("title", tab.title.signal_cloned().map(|x| option_str_default(x, "")))

                                                                .style_signal("margin-left", none_if(tab.insert_animation.signal(), 1.0, px_range, INSERT_LEFT_MARGIN, 0.0))
                                                                .style_signal("height", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_HEIGHT))
                                                                .style_signal("padding-top", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_PADDING))
                                                                .style_signal("padding-bottom", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_PADDING))
                                                                .style_signal("border-top-width", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_BORDER_WIDTH))
                                                                .style_signal("border-bottom-width", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_BORDER_WIDTH))
                                                                .style_signal("opacity", none_if(tab.insert_animation.signal(), 1.0, float_range, 0.0, 1.0))

                                                                .style_signal("transform", tab.insert_animation.signal().map(|t| {
                                                                    t.none_if(1.0).map(|t| format!("rotateX({}deg)", ease(t).range_inclusive(-90.0, 0.0)))
                                                                }))

                                                                .style_signal("top", none_if(tab.drag_over.signal(), 0.0, px_range, 0.0, DRAG_GAP_PX))

                                                                // TODO a bit hacky
                                                                .with_element(|dom, element: HtmlElement| {
                                                                    dom.event(clone!(state, index, group, tab => move |e: MouseDownEvent| {
                                                                        tab.holding.set_neq(true);

                                                                        if let Some(index) = index.get() {
                                                                            let shift = e.shift_key();
                                                                            // TODO is this correct ?
                                                                            // TODO test this, especially on Mac
                                                                            // TODO what if both of these are true ?
                                                                            let ctrl = e.ctrl_key() || e.meta_key();
                                                                            let alt = e.alt_key();

                                                                            if !shift && !ctrl && !alt {
                                                                                let rect = element.get_bounding_client_rect();
                                                                                state.drag_start(e.client_x(), e.client_y(), rect, group.clone(), tab.clone(), index);
                                                                            }
                                                                        }
                                                                    }))
                                                                })

                                                                // TODO only attach this when holding
                                                                .global_event(clone!(tab => move |_: MouseUpEvent| {
                                                                    tab.holding.set_neq(false);
                                                                }))

                                                                .event(clone!(state, index, group, tab => move |_: MouseEnterEvent| {
                                                                    // TODO should this be inside of the if ?
                                                                    state.hover_tab(&tab);

                                                                    if let Some(index) = index.get() {
                                                                        state.drag_over(group.clone(), index);
                                                                    }
                                                                }))

                                                                .event(clone!(state, tab => move |_: MouseLeaveEvent| {
                                                                    // TODO should this check the index, like MouseEnterEvent ?
                                                                    state.unhover_tab(&tab);
                                                                }))

                                                                // TODO replace with MouseClickEvent
                                                                .event(clone!(index, group, tab => move |e: MouseUpEvent| {
                                                                    if index.get().is_some() {
                                                                        let shift = e.shift_key();
                                                                        // TODO is this correct ?
                                                                        // TODO test this, especially on Mac
                                                                        // TODO what if both of these are true ?
                                                                        let ctrl = e.ctrl_key() || e.meta_key();
                                                                        let alt = e.alt_key();

                                                                        match e.button() {
                                                                            MouseButton::Left => {
                                                                                // TODO a little hacky
                                                                                if !tab.close_hovered.get() {
                                                                                    if ctrl && !shift && !alt {
                                                                                        group.ctrl_select_tab(&tab);

                                                                                    } else if !ctrl && shift && !alt {
                                                                                        group.shift_select_tab(&tab);

                                                                                    } else if !ctrl && !shift && !alt {
                                                                                        group.click_tab(&tab);
                                                                                    }
                                                                                }
                                                                            },
                                                                            _ => {},
                                                                        }
                                                                    }
                                                                })))
                                                    })))
                                            }),
                                        ])
                                    })
                                })))
                        }),
                    ])
                }),
            ])
        }),
    );

    // TODO a little hacky, needed to ensure that scrolling happens after everything is created
    stdweb::web::window().request_animation_frame(|_| {
        IS_LOADED.set_neq(true);
        log!("Loaded");
    });

    log!("Finished");


    js! { @(no_return)
        setInterval(@{clone!(state => move || {
            state.process_message(SidebarMessage::TabChanged {
                tab_index: 2,
                change: TabChange::Title {
                    new_title: Some(generate_uuid().to_string()),
                },
            });

            /*state.process_message(SidebarMessage::TabChanged {
                tab_index: 0,
                change: TabChange::Pinned {
                    pinned: false,
                },
            });*/

            state.process_message(SidebarMessage::TabRemoved {
                tab_index: 0,
            });

            state.process_message(SidebarMessage::TabRemoved {
                tab_index: 8,
            });

            /*state.process_message(SidebarMessage::TabInserted {
                tab_index: 0,
                tab: server::Tab {
                    serialized: server::SerializedTab {
                        id: generate_uuid(),
                        timestamp_created: Date::now()
                    },
                    focused: false,
                    unloaded: true,
                    pinned: true,
                    favicon_url: Some("http://www.saltybet.com/favicon.ico".to_owned()),
                    url: Some("top".to_owned()),
                    title: Some("top".to_owned()),
                },
            });*/

            state.process_message(SidebarMessage::TabInserted {
                tab_index: 12,
                tab: server::Tab {
                    serialized: server::SerializedTab {
                        id: generate_uuid(),
                        timestamp_created: Date::now()
                    },
                    focused: false,
                    unloaded: true,
                    pinned: false,
                    favicon_url: Some("http://www.saltybet.com/favicon.ico".to_owned()),
                    url: Some("bottom".to_owned()),
                    title: Some("bottom".to_owned()),
                },
            });

            /*for _ in 0..10 {
                state.process_message(SidebarMessage::TabRemoved {
                    window_index: 2,
                    tab_index: 0,
                });
            }

            state.process_message(SidebarMessage::WindowRemoved {
                window_index: 2,
            });

            state.process_message(SidebarMessage::WindowInserted {
                window_index: 2,
                window: server::Window {
                    serialized: server::SerializedWindow {
                        id: generate_uuid(),
                        name: None,
                        timestamp_created: Date::now(),
                    },
                    focused: false,
                    tabs: vec![],
                },
            });

            for index in 0..10 {
                state.process_message(SidebarMessage::TabInserted {
                    window_index: 2,
                    tab_index: index,
                    tab: server::Tab {
                        serialized: server::SerializedTab {
                            id: generate_uuid(),
                            timestamp_created: Date::now(),
                        },
                        focused: index == 7,
                        unloaded: index == 5,
                        pinned: index == 0 || index == 1 || index == 2,
                        favicon_url: Some("http://www.saltybet.com/favicon.ico".to_owned()),
                        url: Some("https://www.example.com/foo?bar#qux".to_owned()),
                        title: Some("Foo".to_owned()),
                    },
                });
            }*/
        })}, @{INSERT_ANIMATION_DURATION + 2000.0});
    }

    js! { @(no_return)
        setInterval(@{move || {
            state.process_message(SidebarMessage::TabInserted {
                tab_index: 0,
                tab: server::Tab {
                    serialized: server::SerializedTab {
                        id: generate_uuid(),
                        timestamp_created: Date::now()
                    },
                    focused: false,
                    unloaded: true,
                    pinned: true,
                    favicon_url: Some("http://www.saltybet.com/favicon.ico".to_owned()),
                    url: Some("top".to_owned()),
                    title: Some("top".to_owned()),
                },
            });
        }}, @{INSERT_ANIMATION_DURATION + 11000.0});
    }
}


fn main() {
    tab_organizer::set_panic_hook(|message| {
        let message = Arc::new(message);
        FAILED.set(Some(message.clone()));
        PromiseFuture::print_error_panic(&*message);
    });


    log!("Starting");

    stylesheet!("*", {
        .style("text-overflow", "ellipsis")

        .style("vertical-align", "middle") /* TODO I can probably get rid of this */

        /* TODO is this correct ?*/
        .style("background-repeat", "no-repeat")
        .style("background-size", "100% 100%")
        .style("cursor", "inherit")
        .style("position", "relative")

        /* TODO are these a good idea ? */
        .style("outline-width", "0px")
        .style("outline-color", "transparent")
        .style("outline-style", "solid")

        .style("border-width", "0px")
        .style("border-color", "transparent")
        .style("border-style", "solid")

        .style("margin", "0px")
        .style("padding", "0px")

        .style("background-color", "transparent")

        .style("flex-shrink", "0") /* 1 */
        .style("flex-grow", "0") /* 1 */
        .style("flex-basis", "auto") /* 0% */ /* TODO try out other stuff like min-content once it becomes available */
    });

    stylesheet!("html, body", {
        .style("width", "100%")
        .style("height", "100%")

        .style(["-moz-user-select", "user-select"], "none")
    });

    // Disables the browser scroll restoration
    js! { @(no_return)
        if ("scrollRestoration" in history) {
            history.scrollRestoration = "manual";
        }
    }

    dominator::append_dom(&dominator::body(), {
        let show = Mutable::new(false);

        set_timeout(clone!(show => move || {
            show.set_neq(true);
        }), LOADING_MESSAGE_THRESHOLD);

        html!("div", {
            .class(&TOP_STYLE)
            .class(&TEXTURE_STYLE)

            .mixin(visible(not(IS_LOADED.signal())))

            .children(&mut [
                html!("div", {
                    .class(&MODAL_STYLE)
                    .class(&CENTER_STYLE)
                    .class(&LOADING_STYLE)

                    .mixin(visible(and(show.signal(), not(IS_LOADED.signal()))))

                    .children(&mut [
                        text("LOADING..."),
                    ])
                })
            ])
        })
    });


    js! { @(no_return)
        setTimeout(@{move || {
            let window: server::Window = server::Window {
                serialized: server::SerializedWindow {
                    id: generate_uuid(),
                    name: None,
                    timestamp_created: Date::now(),
                },
                focused: false,
                tabs: (0..100).map(|index| {
                    server::Tab {
                        serialized: server::SerializedTab {
                            id: generate_uuid(),
                            timestamp_created: Date::now(),
                        },
                        focused: index == 7,
                        unloaded: index == 5,
                        pinned: index == 0 || index == 1 || index == 2,
                        favicon_url: Some("http://www.saltybet.com/favicon.ico".to_owned()),
                        url: Some("https://www.example.com/foo?bar#qux".to_owned()),
                        title: Some("Foo".to_owned()),
                    }
                }).collect(),
            };

            initialize(Arc::new(State::new(Options::new(), window)));
        }}, 1500);
    }
}
