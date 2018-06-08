/*#![feature(proc_macro, proc_macro_non_items, generators, pin)]

#[macro_use]
extern crate tab_organizer;
#[macro_use]
extern crate stdweb;
extern crate web_extensions;
extern crate discard;
extern crate futures;
#[macro_use]
extern crate serde_derive;
extern crate serde;
extern crate serde_json;
extern crate uuid;

use discard::DiscardOnDrop;

mod migrate;
mod state;
mod serializer;
mod initialize;

fn main() {
    console!(log, "Hi!!!");

    DiscardOnDrop::leak(web_extensions::storage::on_change(|changes, kind| {
        log!("{:#?} {:#?}", changes, kind);
    }));

    tab_organizer::spawn(initialize::initialize())
}
*/

fn main() {

}
