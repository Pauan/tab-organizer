#[macro_use]
extern crate stdweb;
extern crate web_extensions;
extern crate discard;
extern crate futures;

use futures::future::Future;
use discard::DiscardOnDrop;
use stdweb::PromiseFuture;
use web_extensions::storage;
use web_extensions::traits::*;


fn main() {
    console!(log, "Hi!!!");

    DiscardOnDrop::leak(storage::on_change(|changes, kind| {
        console!(log, format!("{:#?} {:#?}", changes, kind));
    }));

    use stdweb::Value;

    PromiseFuture::spawn(
        storage::Local.get_all()
            .map(|x| console!(log, format!("{:#?}", x)))
            .and_then(|_| storage::Local.set("foo", 10))
            .and_then(|_| storage::Local.get_all())
            .map(|x| console!(log, format!("{:#?}", x)))
            .and_then(|_| storage::Local.remove_many(&["foo"]))
            .map_err(|e| console!(error, e))
    );
}
