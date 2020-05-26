#![warn(unreachable_pub)]

use std::rc::Rc;
use wasm_bindgen::prelude::*;
use dominator::{Dom, clone, html, events, with_node};
use tab_organizer::{log, info, connect, panic_hook, set_print_logs, Port};
use tab_organizer::state::{options, SerializedTab};
use web_sys::HtmlTextAreaElement;
use futures_signals::signal::{Mutable, SignalExt};
use futures::FutureExt;
use futures::stream::{StreamExt, TryStreamExt};


#[derive(Debug)]
struct State {
    port: Rc<Port<options::ClientMessage, options::ServerMessage>>,
    loading: Mutable<bool>,
    tabs: Mutable<Vec<SerializedTab>>,
}

impl State {
    fn new(port: Rc<Port<options::ClientMessage, options::ServerMessage>>) -> Rc<Self> {
        Rc::new(Self {
            port,
            loading: Mutable::new(false),
            tabs: Mutable::new(vec![]),
        })
    }

    fn button<F>(name: &str, mut f: F) -> Dom where F: FnMut() + 'static {
        let hovered = Mutable::new(false);
        let pressed = Mutable::new(false);
        let focused = Mutable::new(false);

        html!("button", {
            .class([
                "browser-style",
                "default",
            ])

            .class_signal("hover", hovered.signal())
            .class_signal("pressed", pressed.signal())
            .class_signal("focused", focused.signal())

            .text(name)

            .event(move |_: events::Click| {
                f();
            })

            .event(clone!(hovered => move |_: events::MouseEnter| {
                hovered.set_neq(true);
            }))

            .event(move |_: events::MouseLeave| {
                hovered.set_neq(false);
            })

            .event(clone!(pressed => move |_: events::MouseDown| {
                pressed.set_neq(true);
            }))

            .global_event(move |_: events::MouseUp| {
                pressed.set_neq(false);
            })

            .event(clone!(focused => move |_: events::Focus| {
                focused.set_neq(true);
            }))

            .global_event(move |_: events::Blur| {
                focused.set_neq(false);
            })
        })
    }

    fn render(state: Rc<Self>) -> Dom {
        html!("div", {
            .children(&mut [
                Self::button("Export", clone!(state => move || {
                    state.loading.set_neq(true);
                    state.port.send_message(&options::ClientMessage::Export);
                })),

                html!("textarea" => HtmlTextAreaElement, {
                    .with_node!(element => {
                        .event(clone!(state => move |_: events::Change| {
                            state.port.send_message(&options::ClientMessage::Import { data: element.value() });
                        }))
                    })
                }),

                html!("div", {
                    .style("overflow", "auto")
                    .style("height", "500px")

                    .children_signal_vec(state.tabs.signal_ref(|tabs| {
                        tabs.into_iter().map(|tab| {
                            html!("div", {
                                .text(&tab.url.as_deref().unwrap_or(""))
                            })
                        }).collect()
                    }).to_signal_vec())
                })
            ])
        })
    }
}


#[wasm_bindgen(start)]
pub async fn main_js() -> Result<(), JsValue> {
    std::panic::set_hook(Box::new(panic_hook));
    set_print_logs();

    log!("Starting");

    let port = Rc::new(connect::<options::ClientMessage, options::ServerMessage>("options"));

    port.send_message(&options::ClientMessage::Initialize);

    let _ = port.on_message()
        .map(|x| -> Result<_, JsValue> { Ok(x) })
        .try_fold(None, move |mut state, message| {
            // TODO remove this boxed
            clone!(port => async move {
                info!("Received message {:#?}", message);

                match message {
                    options::ServerMessage::Initial => {
                        log!("Options page started");

                        state = Some({
                            let state = State::new(port);
                            dominator::append_dom(&dominator::body(), State::render(state.clone()));
                            state
                        });
                    },

                    options::ServerMessage::ExportFinished => {
                        state.as_ref().unwrap().loading.set_neq(false);
                    },

                    options::ServerMessage::Imported { tabs } => {
                        state.as_ref().unwrap().tabs.set(tabs);
                    },
                }

                Ok(state)
            }.boxed_local())
        }).await?;

    Ok(())
}
