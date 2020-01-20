use std::sync::Arc;
use dominator::{Dom, html, clone, events, with_node, apply_methods, RefFn, DomBuilder};
use dominator::animation::{MutableAnimation, Percentage};
use dominator::traits::*;
use web_sys::{HtmlElement, HtmlInputElement};
use futures_signals::map_ref;
use futures_signals::signal::{Signal, SignalExt, Mutable, and, or, always};
use futures_signals::signal_vec::SignalVecExt;
use wasm_bindgen::intern;
use lazy_static::lazy_static;

use tab_organizer::styles::*;
use crate::constants::*;
use crate::{cursor, culling, search, url_bar, FAILED, IS_LOADED};
use crate::types::{State, DragState, Group, Tab, TabMenuState, WindowSize, MenuMode};
use crate::menu::MenuBuilder;
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
    let favicon_url = tab.favicon_url.clone();

    lazy_static! {
        static ref LOADING_URL: Arc<String> = Arc::new(intern("icons/firefox/tab-loading.png").to_string());
    }

    html!("img", {
        .class(&*TAB_FAVICON_STYLE)
        /*.class([
            &*TAB_FAVICON_STYLE,
            &*ICON_STYLE,
        ])*/

        .class_signal(&*TAB_FAVICON_STYLE_UNLOADED, tab.is_unloaded())

        .attribute_signal("src", tab.is_loading()
            // TODO make this more efficient somehow ?
            .switch(move |is_loading| -> Box<dyn Signal<Item = Option<Arc<String>>> + Unpin> {
                if is_loading {
                    Box::new(always(Some(LOADING_URL.clone())))

                } else {
                    Box::new(favicon_url.signal_cloned())
                }
            })
            .map(|x| {
                RefFn::new(x, move |x| {
                    x.as_ref().map(|x| x.as_str()).unwrap_or(intern(DEFAULT_FAVICON))
                })
            }))

        .apply(mixin)
    })
}

fn tab_attention(tab: &Tab) -> Dom {
    html!("img", {
        .class(&*TAB_ATTENTION_STYLE)

        .visible_signal(tab.has_attention.signal())

        .attribute("src", "icons/firefox/indicator-tab-attention.svg")
    })
}

fn tab_audio(state: &Arc<State>, tab: &Arc<Tab>, pinned: bool) -> Dom {
    html!("img", {
        .class(&*TAB_AUDIO_STYLE)

        .class_signal(&*TAB_AUDIO_HOVER_STYLE, tab.audio_hovered.signal())

        .apply_if(pinned, |dom| dom.class(&*TAB_AUDIO_PINNED_STYLE))

        .visible_signal(map_ref! {
            let playing = tab.playing_audio.signal(),
            let muted = tab.muted.signal() => {
                *playing || *muted
            }
        })

        .attribute_signal("title", tab.muted.signal().map(|muted| {
            if muted {
                "Unmute tab"

            } else {
                "Mute tab"
            }
        }))

        .attribute_signal("src", map_ref! {
            let playing = tab.playing_audio.signal(),
            let muted = tab.muted.signal() => move {
                if *muted {
                    if pinned {
                        Some(intern("icons/firefox/tab-audio-muted-small.svg"))
                    } else {
                        Some(intern("icons/firefox/tab-audio-muted.svg"))
                    }

                } else if *playing {
                    if pinned {
                        Some(intern("icons/firefox/tab-audio-playing-small.svg"))
                    } else {
                        Some(intern("icons/firefox/tab-audio-playing.svg"))
                    }

                } else {
                    None
                }
            }
        })

        .event(clone!(tab => move |_: events::MouseEnter| {
            tab.audio_hovered.set_neq(true);
        }))

        .event(clone!(tab => move |_: events::MouseLeave| {
            tab.audio_hovered.set_neq(false);
        }))

        .event(clone!(state, tab => move |_: events::Click| {
            state.set_muted(vec![tab.id], !tab.muted.get());
        }))
    })
}

fn tab_text<A>(tab: &Tab, mixin: A) -> Dom where A: FnOnce(DomBuilder<HtmlElement>) -> DomBuilder<HtmlElement> {
    html!("div", {
        .class([
            &*STRETCH_STYLE,
            &*TAB_TEXT_STYLE,
        ])

        .text_signal(tab.title.signal_cloned().map(|x| option_str_default(x, "")))

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

fn tab_base_template<A>(state: &State, tab: &Tab, mixin: A) -> Dom
    where A: FnOnce(DomBuilder<HtmlElement>) -> DomBuilder<HtmlElement> {

    html!("div", {
        .class([
            &*ROW_STYLE,
            &*TAB_STYLE,
            //&*MENU_ITEM_STYLE,
        ])

        .cursor!(state.is_dragging(), intern("pointer"))

        .class_signal(&*TAB_UNLOADED_STYLE, tab.is_unloaded())
        .class_signal(&*TAB_FOCUSED_STYLE, tab.is_focused())

        .apply(mixin)
    })
}


fn tab_template<A>(state: &Arc<State>, group: &Arc<Group>, tab: &Arc<Tab>, mixin: A) -> Dom
    where A: FnOnce(DomBuilder<HtmlElement>) -> DomBuilder<HtmlElement> {

    tab_base_template(state, tab, move |dom| { dom
        // TODO only define 1 global event somehow
        .event(clone!(state, group, tab => move |e: events::ContextMenu| {
            let mode = if tab.selected.get() {
                MenuMode::Group

            } else {
                MenuMode::Tab
            };

            state.menus.show(TabMenuState {
                mode,
                x: e.x() as f64,
                y: e.y() as f64,
                group: group.clone(),
                tab: tab.clone(),
                selected: group.selected_tabs(),
            });
        }))

        .apply(mixin)
    })
}


impl State {
    // TODO code duplication
    fn render_pinned_group(state: Arc<Self>, group: Arc<Group>) -> Dom {
        html!("div", {
            .class([
                &*ROW_STYLE,
                &*WRAP_STYLE,
                &*GROUP_PINNED_STYLE,
            ])

            .visible_signal(group.visible.signal())

            .children_signal_vec(group.tabs.signal_vec_cloned()
                .delay_remove(|tab| tab.wait_until_removed())
                .filter_signal_cloned(|tab| tab.visible.signal())
                .map(clone!(state => move |tab| {
                    tab_template(&state, &group, &tab, |dom| apply_methods!(dom, {
                        .class(&*TAB_PINNED_STYLE)

                        .class_signal(&*TAB_HOVER_STYLE, state.is_tab_hovered(&tab))
                        //.class_signal(&*MENU_ITEM_HOVER_STYLE, state.is_tab_hovered(&tab))
                        .class_signal(&*TAB_UNLOADED_HOVER_STYLE, and(state.is_tab_hovered(&tab), tab.is_unloaded()))
                        .class_signal(&*TAB_FOCUSED_HOVER_STYLE, and(state.is_tab_hovered(&tab), tab.is_focused()))

                        //.class_signal(&*TAB_HOLD_STYLE, state.is_tab_holding(&tab))
                        //.class_signal(&*MENU_ITEM_HOLD_STYLE, state.is_tab_holding(&tab))

                        .class_signal(&*TAB_SELECTED_STYLE, tab.selected.signal())
                        .class_signal(&*TAB_SELECTED_HOVER_STYLE, and(state.is_tab_hovered(&tab), tab.selected.signal()))
                        .class_signal(&*MENU_ITEM_SHADOW_STYLE, or(tab.is_focused(), tab.selected.signal()))

                        .class_signal(&*TAB_PINNED_HOVER_STYLE, state.is_tab_hovered(&tab))
                        .class_signal(&*TAB_PINNED_FOCUSED_STYLE, tab.is_focused())
                        .class_signal(&*TAB_PINNED_SELECTED_STYLE, tab.selected.signal())
                        .class_signal(&*TAB_PINNED_SELECTED_HOVER_STYLE, and(state.is_tab_hovered(&tab), tab.selected.signal()))

                        .attribute_signal("title", tab.title.signal_cloned().map(|x| option_str_default(x, "")))

                        .style_signal("width", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_HEIGHT))
                        .style_signal("height", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_HEIGHT))
                        .style_signal("padding-left", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_PADDING))
                        .style_signal("padding-right", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_PADDING))
                        .style_signal("padding-bottom", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_PADDING))
                        .style_signal("border-top-width", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_BORDER_CROWN_WIDTH))
                        .style_signal("border-left-width", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_BORDER_WIDTH))
                        .style_signal("border-right-width", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_BORDER_WIDTH))
                        .style_signal("border-bottom-width", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_BORDER_WIDTH))
                        .style_signal("opacity", none_if(tab.insert_animation.signal(), 1.0, float_range, 0.0, 1.0))

                        .style_signal("transform", tab.insert_animation.signal().map(|t| {
                            t.none_if(1.0).map(|t| format!("rotateX({}deg)", ease(t).range_inclusive(-90.0, 0.0)))
                        }))

                        .with_node!(element => {
                            .event(clone!(state, group, tab => move |e: events::MouseDown| {
                                // TODO a little hacky
                                if !tab.close_hovered.get() && !tab.audio_hovered.get() {
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
                                        state.close_tabs(&[ tab.clone() ]);
                                    }
                                },
                                events::MouseButton::Right => {
                                },
                                _ => {},
                            }
                        }))

                        .children(&mut [
                            tab_favicon(&tab, |dom| { dom
                                .style_signal("width", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_FAVICON_SIZE))
                                .style_signal("height", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_FAVICON_SIZE))
                                .style_signal("margin-left", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_FAVICON_LEFT_MARGIN))
                                .style_signal("margin-right", none_if(tab.insert_animation.signal(), 1.0, px_range, 0.0, TAB_FAVICON_RIGHT_MARGIN))
                            }),

                            tab_attention(&tab),

                            tab_audio(&state, &tab, true),
                        ])
                    }))
                })))
        })
    }

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

                            tab_template(&state, &group, &tab, |dom| apply_methods!(dom, {
                                .class_signal(&*TAB_HOVER_STYLE, state.is_tab_hovered(&tab))
                                //.class_signal(&*MENU_ITEM_HOVER_STYLE, state.is_tab_hovered(&tab))
                                .class_signal(&*TAB_UNLOADED_HOVER_STYLE, and(state.is_tab_hovered(&tab), tab.is_unloaded()))
                                .class_signal(&*TAB_FOCUSED_HOVER_STYLE, and(state.is_tab_hovered(&tab), tab.is_focused()))

                                //.class_signal(&*TAB_HOLD_STYLE, state.is_tab_holding(&tab))
                                //.class_signal(&*MENU_ITEM_HOLD_STYLE, state.is_tab_holding(&tab))

                                .class_signal(&*TAB_SELECTED_STYLE, tab.selected.signal())
                                .class_signal(&*TAB_SELECTED_HOVER_STYLE, and(state.is_tab_hovered(&tab), tab.selected.signal()))
                                .class_signal(&*MENU_ITEM_SHADOW_STYLE, or(tab.is_focused(), tab.selected.signal()))

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

                                .with_node!(element => {
                                    .event(clone!(state, group, tab => move |e: events::MouseDown| {
                                        // TODO a little hacky
                                        if !tab.close_hovered.get() && !tab.audio_hovered.get() {
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
                                                state.close_tabs(&[ tab.clone() ]);
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

                                    tab_attention(&tab),

                                    tab_audio(&state, &tab, false),

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
                                            state.close_tabs(&[ tab.clone() ]);
                                        }))
                                    }),
                                ])
                            }))
                        })))
                }),
            ])
        })
    }

    fn render_global_menu(state: &Arc<Self>) -> Dom {
        state.menus.global.render(|menu| { menu
            .submenu("Sort tabs by...", Some("/icons/iconic/sort-ascending.svg"), |menu| { menu
                .toggle("Window", state.options.sort_tabs.signal_ref(|x| *x == SortTabs::Window), clone!(state => move || {
                    state.options.sort_tabs.set_neq(SortTabs::Window);
                }))

                .toggle("Tag", state.options.sort_tabs.signal_ref(|x| *x == SortTabs::Tag), clone!(state => move || {
                    state.options.sort_tabs.set_neq(SortTabs::Tag);
                }))

                .separator()

                .toggle("Time last seen", state.options.sort_tabs.signal_ref(|x| *x == SortTabs::TimeFocused), clone!(state => move || {
                    state.options.sort_tabs.set_neq(SortTabs::TimeFocused);
                }))

                .toggle("Time created", state.options.sort_tabs.signal_ref(|x| *x == SortTabs::TimeCreated), clone!(state => move || {
                    state.options.sort_tabs.set_neq(SortTabs::TimeCreated);
                }))

                .separator()

                .toggle("URL", state.options.sort_tabs.signal_ref(|x| *x == SortTabs::Url), clone!(state => move || {
                    state.options.sort_tabs.set_neq(SortTabs::Url);
                }))

                .toggle("Name", state.options.sort_tabs.signal_ref(|x| *x == SortTabs::Name), clone!(state => move || {
                    state.options.sort_tabs.set_neq(SortTabs::Name);
                }))
            })
        })
    }

    fn make_group_header(menu: MenuBuilder, state: &Arc<State>) -> MenuBuilder {
        menu
            .header("Group...")

            .action(
                "Select all tabs",
                Some("/icons/iconic/plus.svg"),
                state.menus.state.signal_ref(move |state| {
                    if let Some(ref state) = state {
                        let len = state.group.visible_tabs_len();
                        state.selected.len() < len

                    } else {
                        false
                    }
                }),
                clone!(state => move || {
                    let mut state = state.menus.state.lock_mut();

                    state.as_ref().unwrap().group.select_all_tabs();

                    *state = None;
                }),
            )

            .action(
                "Unselect all tabs",
                Some("/icons/iconic/minus.svg"),
                state.menus.state.signal_ref(move |state| {
                    if let Some(ref state) = state {
                        state.selected.len() > 0

                    } else {
                        false
                    }
                }),
                clone!(state => move || {
                    let mut state = state.menus.state.lock_mut();

                    state.as_ref().unwrap().group.unselect_all_tabs();

                    *state = None;
                }),
            )
    }

    fn make_menu_tabs(menu: MenuBuilder, state: &Arc<State>) -> MenuBuilder {
        fn with_tabs<F>(state: &State, f: F) where F: FnOnce(&[Arc<Tab>]) {
            let mut state = state.menus.state.lock_mut();

            state.as_ref().unwrap().with_tabs(f);

            *state = None;
        }

        menu
            // TODO put a confirmation box ?
            .action(
                "Unload",
                Some("/icons/iconic/account-logout.svg"),
                state.menus.state.signal_ref(move |state| {
                    if let Some(ref state) = state {
                        state.with_tabs(|tabs| tabs.into_iter().any(|tab| !tab.status.get().is_unloaded()))

                    } else {
                        false
                    }
                }),
                clone!(state => move || {
                    with_tabs(&state, |tabs| {
                        state.unload_tabs(tabs.into_iter().map(|x| x.id).collect());
                    });
                }),
            )

            // TODO put a spacer/separator to make it harder to click this by accident
            // TODO put a confirmation box ?
            .action(
                "Close",
                Some("/icons/iconic/x.svg"),
                state.menus.state.signal_ref(move |state| {
                    if let Some(ref state) = state {
                        state.with_tabs(|tabs| tabs.len() > 0)

                    } else {
                        false
                    }
                }),
                clone!(state => move || {
                    with_tabs(&state, |tabs| {
                        state.close_tabs(tabs);
                    });
                }),
            )
    }

    fn render_group_menu(state: &Arc<Self>) -> Dom {
        /*html!("div", {
            .class(&*TAB_MENU_STYLE)

            .style_signal("left", map_ref! {
                let x = state.tab_menu.state.signal_ref(|state| state.as_ref().map(|state| state.x)),
                let size = state.window_size.signal() => {
                    x.map(|x| {
                        px((x + 12.0).max(206.0))
                    })
                }
            })

            .style_signal("top", state.tab_menu.state.signal_ref(|state| state.as_ref().map(|state| px(state.y + 5.0))))

            .children(&mut [
                ,
            ])
        })*/

        state.menus.group.render(|menu| {
            // TODO replace with dominator::apply
            Self::make_menu_tabs(
                Self::make_group_header(menu, state)
                    .separator()
                    .header("Selected tabs..."),
                state,
            )
        })
    }

    fn render_tab_menu(state: &Arc<Self>) -> Dom {
        state.menus.tab.render(|menu| {
            // TODO replace with dominator::apply
            Self::make_menu_tabs(
                Self::make_group_header(menu, state)
                    .separator()
                    .header("Tab..."),
                state,
            )
        })
    }

    pub(crate) fn render(state: Arc<Self>) -> Dom {
        html!("div", {
            .class([
                &*TOP_STYLE,
                &*COLUMN_STYLE,
            ])

            // TODO only attach this when dragging
            .global_event(clone!(state => move |_: events::MouseUp| {
                state.drag_end();
            }))

            // TODO only attach this when dragging
            .global_event(clone!(state => move |e: events::MouseMove| {
                state.drag_move(e.mouse_x(), e.mouse_y());
            }))

            .future(culling::cull_groups(state.clone()))

            .global_event(clone!(state => move |_: events::Resize| {
                // TODO use set_neq ?
                state.window_size.set(WindowSize::new());
            }))

            .global_event_preventable(move |e: events::ContextMenu| {
                // TODO a little bit hacky
                if let None = e.dyn_target::<HtmlInputElement>() {
                    e.prevent_default();
                }
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
                                tab_base_template(&state, &tab,
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
                                            .class_signal(&*TAB_UNLOADED_HOVER_STYLE, tab.is_unloaded())
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

                                            tab_attention(&tab),

                                            tab_audio(&state, &tab, false),

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
                    .class(&*HEADER_STYLE)

                    .children(&mut [
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

                                    .attribute("type", "search")
                                    .attribute("autofocus", "")
                                    .attribute("autocomplete", "off")
                                    .attribute("placeholder", "Search")

                                    .attribute_signal("title", FAILED.signal_cloned().map(|x| option_str_default(x, "")))

                                    .attribute_signal("value", state.search_box.signal_cloned().map(|x| RefFn::new(x, |x| x.as_str())))

                                    .with_node!(element => {
                                        // TODO debounce
                                        .event(clone!(state => move |_: events::Input| {
                                            let value = Arc::new(element.value());
                                            local_storage_set("tab-organizer.search", &value);
                                            // TODO is it faster to not use Arc ?
                                            state.search_parser.set(Arc::new(search::Parsed::new(&value)));
                                            state.search_box.set(value);
                                        }))
                                    })
                                }),

                                {
                                    let hovering = Mutable::new(false);

                                    html!("div", {
                                        .class(&*TOOLBAR_MENU_WRAPPER_STYLE)
                                        .children(&mut [
                                            html!("div", {
                                                .class([
                                                    &*TOOLBAR_MENU_STYLE,
                                                ])

                                                .class_signal(&*TOOLBAR_MENU_HOVER_STYLE, hovering.signal())

                                                // TODO a little hacky
                                                .class_signal(&*TOOLBAR_MENU_OPEN_STYLE, or(
                                                    state.menus.global.is_showing(),
                                                    or(
                                                        state.menus.group.is_showing(),
                                                        state.menus.tab.is_showing(),
                                                    ),
                                                ))

                                                .cursor!(state.is_dragging(), "pointer")

                                                .event(clone!(hovering => move |_: events::MouseEnter| {
                                                    hovering.set_neq(true);
                                                }))

                                                .event(move |_: events::MouseLeave| {
                                                    hovering.set_neq(false);
                                                })

                                                .event(clone!(state => move |_: events::MouseDown| {
                                                    state.menus.global.show();
                                                }))

                                                .children(&mut [
                                                    html!("div", {
                                                        .class(&*HAMBURGER_STYLE)
                                                    }),
                                                    html!("div", {
                                                        .class(&*HAMBURGER_STYLE)
                                                    }),
                                                    html!("div", {
                                                        .class(&*HAMBURGER_STYLE)
                                                    }),
                                                ])
                                            }),

                                            Self::render_global_menu(&state),
                                            Self::render_group_menu(&state),
                                            Self::render_tab_menu(&state),
                                        ])
                                    })
                                },
                            ])
                        }),

                        State::render_pinned_group(state.clone(), state.groups.pinned_group()),
                    ])
                }),

                html!("div", {
                    .class([
                        &*GROUP_LIST_STYLE,
                        &*STRETCH_STYLE,
                    ])

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
