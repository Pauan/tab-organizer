#![warn(unreachable_pub)]

use wasm_bindgen::prelude::*;
use futures::try_join;
use web_extension::browser;
use wasm_bindgen::intern;
use wasm_bindgen_futures::futures_0_3::JsFuture;
use js_sys::Date;
use tab_organizer::{spawn, log, generate_uuid, TimeDifference, Listener, Windows, Database};
use tab_organizer::state;
use tab_organizer::state::SidebarMessage;


#[wasm_bindgen(start)]
pub fn main_js() {
    #[cfg(debug_assertions)]
    std::panic::set_hook(Box::new(console_error_panic_hook::hook));


    struct Db {
        version: u32,
    }

    spawn(async {
        let (windows, database) = try_join!(
            Windows::new(),
            Database::new(),
        )?;

        let db = database.transaction(|tx| {
            Db {
                version: tx.get(intern("version")).unwrap_or(0),
            }
        });


        Listener::new(browser.browser_action().on_clicked(), Closure::wrap(Box::new(move |_: JsValue| {
            let promise = browser.sidebar_action().open();

            spawn(async move {
                let _ = JsFuture::from(promise).await?;
                Ok(())
            });
        }) as Box<dyn FnMut(JsValue)>)).forget();


        tab_organizer::on_message(move |message: SidebarMessage| {
            async move {
                match message {
                    SidebarMessage::Initialize { id } => {
                        Ok(state::Window {
                            serialized: state::SerializedWindow {
                                id: generate_uuid(),
                                name: None,
                                timestamp_created: Date::now(),
                            },
                            focused: false,
                            tabs: (0..1000).map(|index| {
                                state::Tab {
                                    serialized: state::SerializedTab {
                                        id: generate_uuid(),
                                        timestamp_created: Date::now() - (index as f64 * TimeDifference::HOUR),
                                        timestamp_focused: Date::now() - (index as f64 * TimeDifference::HOUR),
                                        tags: vec![
                                            state::Tag {
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
                        })
                    },
                }
            }
        }).forget();


        log!("Backrgound page started");
        Ok(())
    });
}
