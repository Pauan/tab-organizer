#![warn(unreachable_pub)]

use std::rc::Rc;
use wasm_bindgen::prelude::*;
use dominator::clone;
use tab_organizer::{log, info, connect, panic_hook, set_print_logs};
use tab_organizer::state::options;
use futures::FutureExt;
use futures::stream::{StreamExt, TryStreamExt};


#[wasm_bindgen(start)]
pub async fn main_js() -> Result<(), JsValue> {
    std::panic::set_hook(Box::new(panic_hook));
    set_print_logs();

    log!("Starting");

    let port = Rc::new(connect::<options::ClientMessage, options::ServerMessage>("options"));

    port.send_message(&options::ClientMessage::Initialize);

    let _ = port.on_message()
        .map(|x| -> Result<_, JsValue> { Ok(x) })
        .try_for_each(move |message| {
            // TODO remove this boxed
            clone!(port => async move {
                info!("Received message {:#?}", message);

                match message {
                    options::ServerMessage::Initial => {
                        log!("Options page started");
                    },
                }

                Ok(())
            }.boxed_local())
        }).await?;

    Ok(())
}
