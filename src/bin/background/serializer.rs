use serde;
use serde_json;
use stdweb::{PromiseFuture, Once};
use std::ops::{Deref, DerefMut};
use std::rc::Rc;
use std::cell::{RefMut, RefCell};
use futures::Future;
use web_extensions;
use web_extensions::traits::*;


#[derive(Debug)]
pub struct Transaction<'a, A>(RefMut<'a, SerializerState<A>>) where A: 'a;

impl<'a, A> Deref for Transaction<'a, A> {
    type Target = A;

    fn deref(&self) -> &Self::Target {
        &self.0.value
    }
}

impl<'a, A> DerefMut for Transaction<'a, A> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        self.0.changed = true;
        &mut self.0.value
    }
}


#[derive(Debug)]
struct SerializerState<A> {
    value: A,
    changed: bool,
    is_pending: bool,
}

#[derive(Debug)]
pub struct Serializer<A>(Rc<RefCell<SerializerState<A>>>);

impl<A> Clone for Serializer<A> {
    fn clone(&self) -> Self {
        Serializer(self.0.clone())
    }
}

impl<A> Serializer<A> {
    pub fn new(value: A) -> Self {
        Serializer(Rc::new(RefCell::new(SerializerState {
            value,
            changed: false,
            is_pending: false,
        })))
    }
}

impl<A> Serializer<A> where A: serde::Serialize + 'static {
    fn flush(&self) {
        let mut borrow = self.0.borrow_mut();

        borrow.changed = false;
        borrow.is_pending = false;

        let serialized = serde_json::to_string(&borrow.value).unwrap();

        PromiseFuture::spawn(
            web_extensions::storage::Local.set("state", serialized)
                .map_err(|e| console!(error, e))
        );
    }

    pub fn transaction<B, F>(&self, f: F) -> B where F: FnOnce(Transaction<A>) -> B {
        let output = f(Transaction(self.0.borrow_mut()));

        let mut borrow = self.0.borrow_mut();

        if borrow.changed && !borrow.is_pending {
            borrow.is_pending = true;

            let clone = self.clone();

            js! { @(no_return)
                var callback = @{Once(move || clone.flush())};

                setTimeout(function () {
                    callback();
                }, 1000);
            }
        }

        output
    }
}
