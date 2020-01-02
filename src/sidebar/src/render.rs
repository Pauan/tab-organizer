use std::sync::Arc;
use dominator::{Dom, html, clone, events, with_node, apply_methods, RefFn, DomBuilder, text_signal};
use dominator::animation::{MutableAnimation, Percentage};
use dominator::traits::*;
use web_sys::{HtmlElement, HtmlInputElement};
use futures_signals::map_ref;
use futures_signals::signal::{SignalExt, Mutable, and, or};
use futures_signals::signal_vec::SignalVecExt;
use wasm_bindgen::intern;

use crate::constants::*;
use crate::{cursor, culling, search, url_bar, FAILED, IS_LOADED};
use crate::types::{State, DragState, Group, Tab};
use tab_organizer::{none_if, px, px_range, option_str_default, float_range, is_empty, option_str_default_fn, local_storage_set, none_if_px, ease};
use tab_organizer::state::SortTabs;


fn make_url_bar_child<A, D, F>(state: &State, name: &str, mut display: D, f: F) -> Dom
    where A: AsStr,
          D: FnMut(Arc<url_bar::UrlBar>) -> bool + 'static,
          F: FnMut(Option<Arc<url_bar::UrlBar>>) -> A + 'static {
    html!("div", {
        .class([
            &*URL_BAR_TEXT_STYLE,
            name,
        ])

        .visible_signal(state.url_bar.signal_cloned().map(move |url_bar| {
            if let Some(url_bar) = url_bar {
                display(url_bar)

            } else {
                false
            }
        }))

        .text_signal(state.url_bar.signal_cloned().map(f))
    })
}

fn tab_favicon<A>(tab: &Tab, mixin: A) -> Dom where A: FnOnce(DomBuilder<HtmlElement>) -> DomBuilder<HtmlElement> {
    html!("img", {
        .class(&*TAB_FAVICON_STYLE)
        /*.class([
            &*TAB_FAVICON_STYLE,
            &*ICON_STYLE,
        ])*/

        .class_signal(&*TAB_FAVICON_STYLE_UNLOADED, tab.unloaded.signal().first())

        .attribute_signal("src", tab.favicon_url.signal_cloned().map(|x| {
            RefFn::new(x, move |x| x.as_ref().map(|x| x.as_str()).unwrap_or(DEFAULT_FAVICON))
        }))

        .apply(mixin)
    })
}

fn tab_text<A>(tab: &Tab, mixin: A) -> Dom where A: FnOnce(DomBuilder<HtmlElement>) -> DomBuilder<HtmlElement> {
    html!("div", {
        .class([
            &*STRETCH_STYLE,
            &*TAB_TEXT_STYLE,
        ])

        .children(&mut [
            html!("span", {
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
                    }.first()),

                    text_signal(tab.title.signal_cloned().map(|x| option_str_default(x, "")).first()),
                ])
            })
        ])

        .apply(mixin)
    })
}

fn tab_close<A>(mixin: A) -> Dom where A: FnOnce(DomBuilder<HtmlElement>) -> DomBuilder<HtmlElement> {
    html!("div", {
        .class(&*TAB_CLOSE_STYLE)

        .children(&mut [
            html!("img", {
                .class(&*TAB_CLOSE_ICON_STYLE)
                /*.class([
                    &*TAB_CLOSE_STYLE,
                    &*ICON_STYLE,
                ])*/

                .attribute("src", "data/images/button-close.png")
            }),
        ])

        .apply(mixin)
    })
}

fn tab_template<A>(state: &State, tab: &Tab, mixin: A) -> Dom
    where A: FnOnce(DomBuilder<HtmlElement>) -> DomBuilder<HtmlElement> {

    html!("div", {
        .class([
            &*ROW_STYLE,
            &*TAB_STYLE,
            //&*MENU_ITEM_STYLE,
        ])

        .cursor!(state.is_dragging(), intern("pointer"))

        .class_signal(&*TAB_UNLOADED_STYLE, tab.unloaded.signal().first())
        .class_signal(&*TAB_FOCUSED_STYLE, tab.is_focused())

        .apply(mixin)
    })
}


impl State {
    fn render_group(state: Arc<Self>, group: Arc<Group>) -> Dom {
        if state.should_be_dragging_group(group.id) {
            group.drag_top.jump_to(Percentage::new(1.0));
        }

        html!("div", {
            .class(&*GROUP_STYLE)

            .style_signal("top", none_if(group.drag_top.signal(), 0.0, px_range, -1.0, DRAG_GAP_PX - 1.0))
            .style_signal("padding-bottom", none_if(group.drag_over.signal(), 0.0, px_range, 0.0, DRAG_GAP_PX))
            .style_signal("margin-bottom", none_if(group.drag_over.signal(), 0.0, px_range, 0.0, -DRAG_GAP_PX))

            .style_signal("padding-top", none_if(group.insert_animation.signal(), 1.0, px_range, 0.0, GROUP_PADDING_TOP))
            .style_signal("border-top-width", none_if(group.insert_animation.signal(), 1.0, px_range, 0.0, GROUP_BORDER_WIDTH))
            .style_signal("opacity", none_if(group.insert_animation.signal(), 1.0, float_range, 0.0, 1.0))

            .event(clone!(state, group => move |_: events::MouseEnter| {
                state.drag_over_group(&group);
            }))

            .children(&mut [
                if group.show_header {
                    html!("div", {
                        .class([
                            &*ROW_STYLE,
                            &*GROUP_HEADER_STYLE,
                        ])

                        .style_signal("height", none_if(group.insert_animation.signal(), 1.0, px_range, 0.0, GROUP_HEADER_HEIGHT))
                        .style_signal("margin-left", none_if(group.insert_animation.signal(), 1.0, px_range, INSERT_LEFT_MARGIN, 0.0))

                        .children(&mut [
                            html!("div", {
                                .class([
                                    &*GROUP_HEADER_TEXT_STYLE,
                                    &*STRETCH_STYLE,
                                ])
                                .text_signal(group.name.signal_cloned()
                                    // This causes it to remember the previous value if it returns `None`
                                    // TODO dedicated method for this ?
                                    .filter_map(|x| x)
                                    .map(|x| option_str_default(x, "")))
                            }),
                        ])
                    })

                } else {
                    Dom::empty()
                },

                html!("div", {
                    .class(&*GROUP_TABS_STYLE)

                    .style_signal("padding-top", group.tabs_padding.signal().map(none_if_px(0.0)))
                    .style_signal("padding-bottom", none_if(group.insert_animation.signal(), 1.0, px_range, 0.0, GROUP_PADDING_BOTTOM))

                    .children_signal_vec(group.tabs.signal_vec_cloned()
                        .delay_remove(|tab| tab.wait_until_removed())
                        .filter_signal_cloned(|tab| tab.visible.signal())
                        .map(clone!(state => move |tab| {
                            if state.should_be_dragging_tab(group.id, tab.id) {
                                tab.drag_over.jump_to(Percentage::new(1.0));
                            }

                            tab_template(&state, &tab, |dom| apply_methods!(dom, {
                                .class_signal(&*TAB_HOVER_STYLE, state.is_tab_hovered(&tab))
                                //.class_signal(&*MENU_ITEM_HOVER_STYLE, state.is_tab_hovered(&tab))
                                .class_signal(&*TAB_UNLOADED_HOVER_STYLE, and(state.is_tab_hovered(&tab), tab.unloaded.signal().first()))
                                .class_signal(&*TAB_FOCUSED_HOVER_STYLE, and(state.is_tab_hovered(&tab), tab.is_focused()))

                                //.class_signal(&*TAB_HOLD_STYLE, state.is_tab_holding(&tab))
                                //.class_signal(&*MENU_ITEM_HOLD_STYLE, state.is_tab_holding(&tab))

                                .class_signal(&*TAB_SELECTED_STYLE, tab.selected.signal())
                                .class_signal(&*TAB_SELECTED_HOVER_STYLE, and(state.is_tab_hovered(&tab), tab.selected.signal()))
                                .class_signal(&*MENU_ITEM_SHADOW_STYLE, or(tab.is_focused(), tab.selected.signal()))

                                .attribute_signal("title", tab.title.signal_cloned().map(|x| option_str_default(x, "")).first())

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

                                .with_node!(element => {
                                    .event(clone!(state, group, tab => move |e: events::MouseDown| {
                                        // TODO a little hacky
                                        if !tab.close_hovered.get() {
                                            //tab.holding.set_neq(true);

                                            let shift = e.shift_key();
                                            // TODO is this correct ?
                                            // TODO test this, especially on Mac
                                            let ctrl = e.ctrl_key();
                                            let alt = e.alt_key();

                                            if let events::MouseButton::Left = e.button() {
                                                // TODO a little hacky
                                                if ctrl && !shift && !alt {
                                                    group.ctrl_select_tab(&tab);

                                                } else if !ctrl && shift && !alt {
                                                    group.shift_select_tab(&tab);

                                                } else if !ctrl && !shift && !alt {
                                                    state.click_tab(&group, &tab);

                                                    let rect = element.get_bounding_client_rect();
                                                    state.drag_start(e.mouse_x(), e.mouse_y(), rect, &group, &tab);
                                                }
                                            }
                                        }
                                    }))
                                })

                                // TODO only attach this when holding
                                /*.global_event(clone!(tab => move |_: events::MouseUp| {
                                    tab.holding.set_neq(false);
                                }))*/

                                .event(clone!(state, group, tab => move |_: events::MouseEnter| {
                                    // TODO should this be inside of the if ?
                                    state.hover_tab(&tab);
                                    state.drag_over(&group, &tab);
                                }))

                                .event(clone!(state, tab => move |_: events::MouseLeave| {
                                    state.unhover_tab(&tab);
                                }))

                                // TODO replace with MouseClickEvent
                                .event(clone!(state, tab => move |e: events::MouseUp| {
                                    let shift = e.shift_key();
                                    // TODO is this correct ?
                                    // TODO test this, especially on Mac
                                    let ctrl = e.ctrl_key();
                                    let alt = e.alt_key();

                                    match e.button() {
                                        events::MouseButton::Left => {

                                        },
                                        events::MouseButton::Middle => {
                                            if !shift && !ctrl && !alt {
                                                state.close_tab(&tab);
                                            }
                                        },
                                        events::MouseButton::Right => {
                                        },
                                        _ => {},
                                    }
                                }))

                                .children(&mut [
                                    tab_favicon(&tab, |dom| { dom
                                        .style_signal("height", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_FAVICON_SIZE))
                                    }),

                                    tab_text(&tab, |dom| { dom }),

                                    tab_close(|dom| { dom
                                        .class_signal(&*TAB_CLOSE_HOVER_STYLE, tab.close_hovered.signal())
                                        .class_signal(&*TAB_CLOSE_HOLD_STYLE, and(tab.close_hovered.signal(), tab.close_holding.signal()))

                                        .style_signal("height", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_FAVICON_SIZE))
                                        .style_signal("border-top-width", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_CLOSE_BORDER_WIDTH))
                                        .style_signal("border-bottom-width", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_CLOSE_BORDER_WIDTH))

                                        .visible_signal(state.is_tab_hovered(&tab))

                                        .event(clone!(tab => move |_: events::MouseEnter| {
                                            tab.close_hovered.set_neq(true);
                                        }))

                                        .event(clone!(tab => move |_: events::MouseLeave| {
                                            tab.close_hovered.set_neq(false);
                                        }))

                                        .event(clone!(tab => move |_: events::MouseDown| {
                                            tab.close_holding.set_neq(true);
                                        }))

                                        // TODO only attach this when hovering
                                        .global_event(clone!(tab => move |_: events::MouseUp| {
                                            tab.close_holding.set_neq(false);
                                        }))

                                        .event(clone!(state, tab => move |_: events::Click| {
                                            state.close_tab(&tab);
                                        }))
                                    }),
                                ])
                            }))
                        })))
                }),
            ])
        })
    }

    pub(crate) fn render(state: Arc<Self>) -> Dom {
        let window_height = Mutable::new(tab_organizer::window_height());

        html!("div", {
            .class(&*TOP_STYLE)

            // TODO only attach this when dragging
            .global_event(clone!(state => move |_: events::MouseUp| {
                state.drag_end();
            }))

            // TODO only attach this when dragging
            .global_event(clone!(state => move |e: events::MouseMove| {
                state.drag_move(e.mouse_x(), e.mouse_y());
            }))

            .future(culling::cull_groups(state.clone(), window_height.signal()))

            .global_event(move |_: events::Resize| {
                window_height.set_neq(tab_organizer::window_height());
            })

            .children(&mut [
                html!("div", {
                    .class(&*DRAGGING_STYLE)

                    .visible_signal(state.is_dragging())

                    .style_signal("width", state.dragging.state.signal_ref(|dragging| {
                        if let Some(DragState::Dragging { rect, .. }) = dragging {
                            Some(px(rect.width()))

                        } else {
                            None
                        }
                    }))

                    .style_signal("transform", state.dragging.state.signal_ref(|dragging| {
                        if let Some(DragState::Dragging { mouse_y, rect, .. }) = dragging {
                            Some(format!("translate({}px, {}px)", rect.x().round(), (mouse_y - TAB_DRAGGING_TOP)))

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
                                    |dom| dom
                                        .class_signal(&*TAB_SELECTED_STYLE, tab.selected.signal())
                                        .class(&*MENU_ITEM_SHADOW_STYLE)
                                        .style("z-index", format!("-{}", index))

                                        .apply_if(index == 0, |dom| dom
                                            .class(&*TAB_HOVER_STYLE)
                                            /*.class([
                                                &*TAB_HOVER_STYLE,
                                                &*MENU_ITEM_HOVER_STYLE,
                                            ])*/
                                            .class_signal(&*TAB_SELECTED_HOVER_STYLE, tab.selected.signal())
                                            .class_signal(&*TAB_UNLOADED_HOVER_STYLE, tab.unloaded.signal()) // TODO use .first() ?
                                            .class_signal(&*TAB_FOCUSED_HOVER_STYLE, tab.is_focused()))

                                        // TODO use ease-out easing
                                        .apply_if(index > 0 && index < 5, |dom| dom
                                            .style_signal("margin-top", none_if(animation.signal(), 0.0, px_range, 0.0, -(TAB_TOTAL_HEIGHT - 2.0))))

                                        .apply_if(index >= 5, |dom| dom
                                            .style_signal("margin-top", none_if(animation.signal(), 0.0, px_range, 0.0, -TAB_TOTAL_HEIGHT))
                                            // TODO use ease-out easing
                                            .style_signal("opacity", none_if(animation.signal(), 0.0, float_range, 1.0, 0.0)))

                                        .children(&mut [
                                            tab_favicon(&tab, |dom| dom),

                                            tab_text(&tab, |dom| dom),

                                            if index == 0 {
                                                tab_close(|dom| dom)

                                            } else {
                                                dominator::Dom::empty()
                                            },
                                        ]))
                            })
                        }).collect()
                    })).to_signal_vec())
                }),

                html!("div", {
                    .class([
                        &*ROW_STYLE,
                        &*URL_BAR_STYLE,
                    ])

                    .visible_signal(map_ref! {
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
                    })

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
                    .class([
                        &*ROW_STYLE,
                        &*TOOLBAR_STYLE,
                    ])

                    .children(&mut [
                        html!("input" => HtmlInputElement, {
                            .class([
                                &*SEARCH_STYLE,
                                &*STRETCH_STYLE,
                            ])

                            .cursor!(state.is_dragging(), "auto")

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

                            .attribute_signal("value", state.search_box.signal_cloned().map(|x| RefFn::new(x, |x| x.as_str())))

                            .with_node!(element => {
                                .event(clone!(state => move |_: events::Input| {
                                    let value = Arc::new(element.value());
                                    local_storage_set("tab-organizer.search", &value);
                                    // TODO is it faster to not use Arc ?
                                    state.search_parser.set(Arc::new(search::Parsed::new(&value)));
                                    state.search_box.set(value);
                                }))
                            })
                        }),

                        html!("div", {
                            .class(&*TOOLBAR_SEPARATOR_STYLE)
                        }),

                        {
                            let hovering = Mutable::new(false);
                            let holding = Mutable::new(false);

                            html!("div", {
                                .class(&*TOOLBAR_MENU_WRAPPER_STYLE)
                                .children(&mut [
                                    html!("div", {
                                        .class([
                                            &*ROW_STYLE,
                                            &*TOOLBAR_MENU_STYLE,
                                        ])

                                        .cursor!(state.is_dragging(), "pointer")

                                        .class_signal(&*TOOLBAR_MENU_HOLD_STYLE, and(hovering.signal(), holding.signal()))

                                        .event(clone!(hovering => move |_: events::MouseEnter| {
                                            hovering.set_neq(true);
                                        }))

                                        .event(move |_: events::MouseLeave| {
                                            hovering.set_neq(false);
                                        })

                                        .event(clone!(holding => move |_: events::MouseDown| {
                                            holding.set_neq(true);
                                        }))

                                        // TODO only attach this when holding
                                        .global_event(move |_: events::MouseUp| {
                                            holding.set_neq(false);
                                        })

                                        .event(clone!(state => move |_: events::Click| {
                                            state.menu.show();
                                        }))

                                        .text("Menu")
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
                    .class(&*GROUP_LIST_STYLE)

                    .event_preventable(move |e: events::MouseDown| {
                        e.prevent_default();
                    })

                    .with_node!(element => {
                        // TODO also update these when groups/tabs are added/removed ?
                        .event(clone!(state, element => move |_: events::Scroll| {
                            if IS_LOADED.get() {
                                let y = element.scroll_top() as f64;
                                // TODO is there a more efficient way of converting to a string ?
                                local_storage_set("tab-organizer.scroll.y", &y.to_string());
                                state.scrolling.y.set_neq(y);
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
                                let old_scroll_y = element.scroll_top() as f64;

                                if old_scroll_y != scroll_y {
                                    element.set_scroll_top(scroll_y as i32);

                                    // TODO does this cause a reflow ?
                                    let new_scroll_y = element.scroll_top() as f64;

                                    if new_scroll_y != scroll_y {
                                        state.scrolling.y.set_neq(new_scroll_y);
                                    }
                                }
                            }

                            async {}
                        })))
                    })

                    .children(&mut [
                        // TODO this is pretty hacky, but I don't know a better way to make it work
                        html!("div", {
                            .class(&*GROUP_LIST_CHILDREN_STYLE)

                            .style_signal("padding-top", state.groups_padding.signal().map(none_if_px(0.0)))
                            .style_signal("height", state.scrolling.height.signal().map(none_if_px(0.0)))

                            .children_signal_vec(state.groups.signal_vec_cloned()
                                .delay_remove(|group| group.wait_until_removed())
                                .filter_signal_cloned(|group| group.visible.signal())
                                .map(clone!(state => move |group| {
                                    State::render_group(state.clone(), group)
                                })))
                        }),

                        html!("div", {
                            .class(&*GROUP_LIST_RIGHT_BORDER)
                        }),
                    ])
                }),
            ])
        })
    }
}
