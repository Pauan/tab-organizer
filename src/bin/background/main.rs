#![feature(proc_macro, conservative_impl_trait, generators)]

#[macro_use]
extern crate tab_organizer;
#[macro_use]
extern crate stdweb;
extern crate web_extensions;
extern crate discard;
extern crate futures_await as futures;
#[macro_use]
extern crate serde_derive;
extern crate serde;
extern crate serde_json;

use futures::future::Future;
use discard::DiscardOnDrop;
use stdweb::PromiseFuture;


mod migrate;
mod state;
mod serializer;


use futures::prelude::{async, await};
use stdweb::web::error::Error;
use web_extensions::windows;

#[async]
fn initialize() -> Result<(), Error> {
    let (state, windows) = await!(
        migrate::initialize().join(
        windows::get_all(true, &[windows::WindowKind::Normal]))
    )?;

    console!(log, windows);

    let state = serializer::Serializer::new(state);

    state.transaction(|state| {
        log!("{:#?}", *state);
    });

    Ok(())
}


fn main() {
    console!(log, "Hi!!!");

    DiscardOnDrop::leak(web_extensions::storage::on_change(|changes, kind| {
        log!("{:#?} {:#?}", changes, kind);
    }));

    PromiseFuture::spawn(
        initialize().map_err(|e| console!(error, e))
    );
}
