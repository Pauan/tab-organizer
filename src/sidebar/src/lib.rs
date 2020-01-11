#![warn(unreachable_pub)]

use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use std::sync::Arc;
use tab_organizer::{Timer, connect, log, info, time, cursor, every_hour, export_function, closure, print_logs};
use tab_organizer::state::{sidebar, Options};
use dominator::{html, stylesheet, clone};
use futures::stream::{StreamExt, TryStreamExt};
use futures_signals::signal::{Mutable, SignalExt};
use lazy_static::lazy_static;
use web_sys::{window, ScrollRestoration};

use crate::types::State;
use crate::constants::*;
use tab_organizer::styles::*;

mod constants;
mod types;
mod search;
mod url_bar;
mod menu;
mod groups;
mod scrolling;
mod dragging;
mod tab;
mod culling;
mod render;


// Whether it should automatically add/remove/update test tabs
const DYNAMIC_TAB_TEST: bool = false;


lazy_static! {
    pub(crate) static ref FAILED: Mutable<Option<Arc<String>>> = Mutable::new(None);

    pub(crate) static ref IS_LOADED: Mutable<bool> = Mutable::new(false);

    static ref SHOW_MODAL: Mutable<bool> = Mutable::new(false);
}


fn initialize(state: Arc<State>) {
    stylesheet!("html, body", {
        .style_signal("cursor", state.is_dragging().map(|is_dragging| {
            if is_dragging {
                Some("grabbing")

            } else {
                None
            }
        }))
    });

    every_hour(clone!(state => move || {
        time!("Updating group titles", {
            state.update_group_titles();
        });
    }));

    dominator::append_dom(&dominator::body(), State::render(state));

    // TODO a little hacky, needed to ensure that scrolling happens after everything is created
    window()
        .unwrap()
        .request_animation_frame(Closure::once_into_js(move |_: f64| {
            IS_LOADED.set_neq(true);
            SHOW_MODAL.set_neq(false);
            log!("Loaded");
        }).unchecked_ref())
        .unwrap();

    log!("Finished");

    /*let mut tag_counter = 0;

    if DYNAMIC_TAB_TEST {
        set_interval(clone!(state => move || {
            state.process_message(BackgroundMessage::TabChanged {
                tab_index: 2,
                changes: vec![
                    TabChange::Title {
                        new_title: Some(generate_uuid().to_string()),
                    },
                ],
            });

            state.process_message(BackgroundMessage::TabChanged {
                tab_index: 3,
                changes: vec![
                    TabChange::Title {
                        new_title: Some("e1".to_string()),
                    },
                ],
            });

            state.process_message(BackgroundMessage::TabChanged {
                tab_index: 3,
                changes: vec![
                    TabChange::Title {
                        new_title: Some("e2".to_string()),
                    },
                ],
            });

            /*state.process_message(BackgroundMessage::TabChanged {
                tab_index: 0,
                changes: vec![
                    TabChange::Pinned {
                        pinned: false,
                    },
                ],
            });*/

            state.process_message(BackgroundMessage::TabRemoved {
                tab_index: 0,
            });

            state.process_message(BackgroundMessage::TabRemoved {
                tab_index: 0,
            });

            state.process_message(BackgroundMessage::TabRemoved {
                tab_index: 8,
            });

            /*state.process_message(BackgroundMessage::TabInserted {
                tab_index: 0,
                tab: shared::Tab {
                    serialized: shared::SerializedTab {
                        id: generate_uuid(),
                        timestamp_created: Date::now(),
                        timestamp_focused: Date::now(),
                    },
                    focused: false,
                    unloaded: true,
                    pinned: true,
                    favicon_url: Some("http://www.saltybet.com/favicon.ico".to_owned()),
                    url: Some("top".to_owned()),
                    title: Some("top".to_owned()),
                },
            });*/

            let timestamp = Date::now();

            state.process_message(BackgroundMessage::TabInserted {
                tab_index: 12,
                tab: shared::Tab {
                    serialized: shared::SerializedTab {
                        id: generate_uuid(),
                        timestamp_created: timestamp,
                        timestamp_focused: timestamp,
                        tags: vec![
                            shared::Tag {
                                name: "New".to_string(),
                                timestamp_added: Date::now(),
                            },
                        ],
                    },
                    focused: false,
                    unloaded: true,
                    pinned: false,
                    favicon_url: Some("http://www.saltybet.com/favicon.ico".to_owned()),
                    url: Some("bottom".to_owned()),
                    title: Some(format!("bottom {}", timestamp)),
                },
            });

            state.process_message(BackgroundMessage::TabInserted {
                tab_index: 13,
                tab: shared::Tab {
                    serialized: shared::SerializedTab {
                        id: generate_uuid(),
                        timestamp_created: timestamp,
                        timestamp_focused: timestamp,
                        tags: vec![],
                    },
                    focused: false,
                    unloaded: true,
                    pinned: false,
                    favicon_url: Some("http://www.saltybet.com/favicon.ico".to_owned()),
                    url: Some("bottom".to_owned()),
                    title: Some(format!("bottom {}", timestamp)),
                },
            });

            state.process_message(BackgroundMessage::TabChanged {
                tab_index: 10,
                changes: vec![
                    TabChange::AddedToTag {
                        tag: shared::Tag {
                            name: tag_counter.to_string(),
                            timestamp_added: Date::now(),
                        },
                    },
                ],
            });

            tag_counter += 1;

            /*for _ in 0..10 {
                state.process_message(BackgroundMessage::TabRemoved {
                    window_index: 2,
                    tab_index: 0,
                });
            }

            state.process_message(BackgroundMessage::WindowRemoved {
                window_index: 2,
            });

            state.process_message(BackgroundMessage::WindowInserted {
                window_index: 2,
                window: shared::Window {
                    serialized: shared::SerializedWindow {
                        id: generate_uuid(),
                        name: None,
                        timestamp_created: Date::now(),
                        timestamp_focused: Date::now(),
                    },
                    focused: false,
                    tabs: vec![],
                },
            });

            for index in 0..10 {
                state.process_message(BackgroundMessage::TabInserted {
                    window_index: 2,
                    tab_index: index,
                    tab: shared::Tab {
                        serialized: shared::SerializedTab {
                            id: generate_uuid(),
                            timestamp_created: Date::now(),
                            timestamp_focused: Date::now(),
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
        }), (INSERT_ANIMATION_DURATION * 2.0) as u32);

        set_interval(move || {
            state.process_message(BackgroundMessage::TabInserted {
                tab_index: 0,
                tab: shared::Tab {
                    serialized: shared::SerializedTab {
                        id: generate_uuid(),
                        timestamp_created: Date::now(),
                        timestamp_focused: Date::now(),
                        tags: vec![
                            shared::Tag {
                                name: "New (Pinned)".to_string(),
                                timestamp_added: Date::now(),
                            },
                        ],
                    },
                    focused: false,
                    unloaded: true,
                    pinned: true,
                    favicon_url: Some("http://www.saltybet.com/favicon.ico".to_owned()),
                    url: Some("top".to_owned()),
                    title: Some("top".to_owned()),
                },
            });

            state.process_message(BackgroundMessage::TabInserted {
                tab_index: 0,
                tab: shared::Tab {
                    serialized: shared::SerializedTab {
                        id: generate_uuid(),
                        timestamp_created: Date::now(),
                        timestamp_focused: Date::now(),
                        tags: vec![
                            shared::Tag {
                                name: "New (Pinned)".to_string(),
                                timestamp_added: Date::now(),
                            },
                        ],
                    },
                    focused: false,
                    unloaded: true,
                    pinned: true,
                    favicon_url: Some("http://www.saltybet.com/favicon.ico".to_owned()),
                    url: Some("top test".to_owned()),
                    title: Some("top test".to_owned()),
                },
            });
        }, (INSERT_ANIMATION_DURATION * 3.0) as u32);
    }*/
}


#[wasm_bindgen(start)]
pub fn main_js() {
    std::panic::set_hook(Box::new(move |info| {
    	let message = Arc::new(info.to_string());
        FAILED.set(Some(message.clone()));
        console_error_panic_hook::hook(info);
    }));


    export_function("print_logs", closure!(move |amount: usize| {
        print_logs(amount);
    }));


    log!("Starting");

    stylesheet!("*", {
        .style("text-overflow", "ellipsis")
        .style("box-sizing", "content-box")

        .style("vertical-align", "middle")

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

        //.style("font-family", "message-box")
        .style("font-size", "13px")
        .style("font-family", "system-ui")

        //.style("background-color", "hsl(0, 0%, 100%)")
        /*.style("background-image", "repeating-linear-gradient(0deg, \
                                        transparent                0px, \
                                        hsla(200, 30%, 30%, 0.017) 2px, \
                                        hsla(200, 30%, 30%, 0.017) 3px)")*/
    });

    // Disables the browser scroll restoration
    window()
        .unwrap()
        .history()
        .unwrap()
        .set_scroll_restoration(ScrollRestoration::Manual)
        .unwrap();

    dominator::append_dom(&dominator::body(), html!("div", {
        .class([
            &*MODAL_STYLE,
            &*CENTER_STYLE,
            &*LOADING_STYLE,
        ])

        .visible_signal(SHOW_MODAL.signal())

        .text("LOADING...")
    }));


    Timer::new(LOADING_MESSAGE_THRESHOLD, move || {
        if !IS_LOADED.get() {
            SHOW_MODAL.set_neq(true);
        }
    }).forget();


    fn search_to_id() -> String {
        let search = window()
                .unwrap()
                .location()
                .search()
                .unwrap();

        js_sys::decode_uri_component(&search[1..])
            .unwrap()
            .into()
    }


    tab_organizer::spawn(async move {
        let port = connect::<sidebar::ClientMessage, sidebar::ServerMessage>("sidebar");

        port.send_message(&sidebar::ClientMessage::Initialize {
            id: search_to_id(),
        });

        let _ = port.on_message()
            .map(|x| -> Result<_, JsValue> { Ok(x) })
            .try_fold(None, move |mut state, message| {
                clone!(port => async move {
                    info!("Received message {:#?}", message);

                    match message {
                        sidebar::ServerMessage::Initial { tabs } => {
                            assert!(state.is_none());

                            state = time!("Initializing", {
                                let state = Arc::new(State::new(port, Options::new(), tabs));
                                initialize(state.clone());
                                Some(state)
                            });
                        },

                        sidebar::ServerMessage::TabInserted { tab_index, tab } => {
                            state.as_ref().unwrap().insert_tab(tab_index, tab);
                        },

                        sidebar::ServerMessage::TabRemoved { tab_index } => {
                            state.as_ref().unwrap().remove_tab(tab_index);
                        },

                        sidebar::ServerMessage::TabChanged { tab_index, changes } => {
                            state.as_ref().unwrap().change_tab(tab_index, changes);
                        },

                        sidebar::ServerMessage::TabFocused { old_tab_index, new_tab_index, new_timestamp_focused } => {
                            state.as_ref().unwrap().focus_tab(old_tab_index, new_tab_index, new_timestamp_focused);
                        },

                        sidebar::ServerMessage::TabMoved { old_tab_index, new_tab_index } => {
                            state.as_ref().unwrap().move_tab(old_tab_index, new_tab_index);
                        },
                    }

                    Ok(state)
                })
            }).await?;

        Ok(())
    });

    /*Timer::new(1500, move || {
        let window: shared::Window = shared::Window {
            serialized: shared::SerializedWindow {
                id: generate_uuid(),
                name: None,
                timestamp_created: Date::now(),
            },
            focused: false,
            tabs: (0..1000).map(|index| {
                shared::Tab {
                    serialized: shared::SerializedTab {
                        id: generate_uuid(),
                        timestamp_created: Date::now() - (index as f64 * TimeDifference::HOUR),
                        timestamp_focused: Date::now() - (index as f64 * TimeDifference::HOUR),
                        tags: vec![
                            shared::Tag {
                                name: if index < 5 { "One".to_string() } else { "Two".to_string() },
                                timestamp_added: index as f64,
                            },
                        ],
                    },
                    focused: index == 7,
                    unloaded: index == 5,
                    pinned: index == 0 || index == 1 || index == 2,
                    favicon_url: Some("http://www.saltybet.com/favicon.ico".to_owned()),
                    url: Some("https://www.example.com/foo?bar#qux".to_owned()),
                    title: Some(format!("Foo {}", index)),
                }
            }).collect(),
        };


    }).forget();*/
}
