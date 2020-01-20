#![warn(unreachable_pub)]

use std::rc::Rc;
use wasm_bindgen::prelude::*;
use dominator::{Dom, clone, html, events};
use tab_organizer::{log, info, connect, panic_hook, set_print_logs, Port};
use tab_organizer::state::options;
use futures_signals::signal::Mutable;
use futures::FutureExt;
use futures::stream::{StreamExt, TryStreamExt};


#[derive(Debug)]
struct State {
    port: Rc<Port<options::ClientMessage, options::ServerMessage>>,
    loading: Mutable<bool>,
}

impl State {
    fn new(port: Rc<Port<options::ClientMessage, options::ServerMessage>>) -> Rc<Self> {
        Rc::new(Self {
            port,
            loading: Mutable::new(false),
        })
    }

    fn render(state: Rc<Self>) -> Dom {
        html!("div", {
            .children(&mut [
                html!("button", {
                    .class([
                        "browser-style",
                        "default",
                    ])

                    .text("Export")

                    .event(clone!(state => move |_: events::Click| {
                        state.loading.set_neq(true);
                        state.port.send_message(&options::ClientMessage::Export);
                    }))
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
                }

                Ok(state)
            }.boxed_local())
        }).await?;

    Ok(())
}
