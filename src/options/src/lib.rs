#![warn(unreachable_pub)]

use wasm_bindgen::prelude::*;
use dominator::clone;
use tab_organizer::{log, info, connect};
use tab_organizer::state::options;
use futures::stream::{StreamExt, TryStreamExt};


#[wasm_bindgen(start)]
pub fn main_js() -> Result<(), JsValue> {
    console_error_panic_hook::set_once();


    log!("Starting");


    tab_organizer::spawn(async move {
        let port = connect::<options::ClientMessage, options::ServerMessage>("options");

        port.send_message(&options::ClientMessage::Initialize);

        let _ = port.on_message()
            .map(|x| -> Result<_, JsValue> { Ok(x) })
            .try_for_each(move |message| {
                clone!(port => async move {
                    info!("Received message {:#?}", message);

                    match message {
                    	options::ServerMessage::Initial => {
                    	},
                    }

                    Ok(())
                })
            }).await?;

        Ok(())
    });


    log!("Options page started");
    Ok(())
}
