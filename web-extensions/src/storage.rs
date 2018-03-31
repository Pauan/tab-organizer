use std::collections::BTreeMap;
use stdweb::{PromiseFuture, JsSerialize, Value};
use stdweb::unstable::{TryFrom, TryInto};
use stdweb::private::ConversionError;
use discard::{DiscardOnDrop, Discard};


pub trait StorageAreaRead {
    fn get_storage_area() -> Value;

    fn get_bytes_in_use_for_keys(&self, keys: &[&str]) -> PromiseFuture<u32> {
        js!( return @{Self::get_storage_area()}.getBytesInUse(@{keys}); ).try_into().unwrap()
    }

    fn get_bytes_in_use(&self) -> PromiseFuture<u32> {
        js!( return @{Self::get_storage_area()}.getBytesInUse(null); ).try_into().unwrap()
    }

    fn get<A>(&self, key: &str) -> PromiseFuture<A>
        where A: TryFrom<Value> + 'static,
              // TODO this is a bit gross
              A::Error: ::std::fmt::Debug {
        js!(
            var key = @{key};
            return @{Self::get_storage_area()}.get(key).then(function (x) { return x[key]; });
        ).try_into().unwrap()
    }

    // TODO make this a HashMap instead ?
    fn get_many(&self, keys: &[&str]) -> PromiseFuture<BTreeMap<String, Value>> {
        js!( return @{Self::get_storage_area()}.get(@{keys}); ).try_into().unwrap()
    }

    // TODO make this a HashMap instead ?
    fn get_all(&self) -> PromiseFuture<BTreeMap<String, Value>> {
        js!( return @{Self::get_storage_area()}.get(null); ).try_into().unwrap()
    }
}


pub trait StorageAreaWrite: StorageAreaRead {
    // TODO constrain this to valid JSON ?
    fn set<A>(&self, key: &str, value: A) -> PromiseFuture<()> where A: JsSerialize {
        js!(
            var value = @{value};

            if (value === void 0) {
                throw new Error("Value cannot be undefined");
            }

            var changes = {};

            changes[@{key}] = value;

            return @{Self::get_storage_area()}.set(changes);
        ).try_into().unwrap()
    }

    fn set_many<'a, A>(&self, iter: A) -> PromiseFuture<()>
        // TODO constrain this to valid JSON ?
        where A: IntoIterator<Item = (&'a str, &'a Value)> {

        let changes = js!( return {}; );

        for (key, value) in iter {
            js! { @(no_return)
                var value = @{value};

                if (value === void 0) {
                    throw new Error("Value cannot be undefined");
                }

                @{&changes}[@{key}] = value;
            }
        }

        js!(
            return @{Self::get_storage_area()}.set(@{changes});
        ).try_into().unwrap()
    }

    fn remove_many(&self, keys: &[&str]) -> PromiseFuture<()> {
        js!( return @{Self::get_storage_area()}.remove(@{keys}); ).try_into().unwrap()
    }

    fn clear(&self) -> PromiseFuture<()> {
        js!( return @{Self::get_storage_area()}.clear(); ).try_into().unwrap()
    }
}


pub struct Sync;

impl StorageAreaRead for Sync {
    fn get_storage_area() -> Value {
        js!( return browser.storage.sync; )
    }
}

impl StorageAreaWrite for Sync {}


pub struct Local;

impl StorageAreaRead for Local {
    fn get_storage_area() -> Value {
        js!( return browser.storage.local; )
    }
}

impl StorageAreaWrite for Local {}


pub struct Managed;

impl StorageAreaRead for Managed {
    fn get_storage_area() -> Value {
        js!( return browser.storage.managed; )
    }
}


#[derive(Debug, Clone)]
pub struct StorageChange {
    pub old_value: Option<Value>,
    pub new_value: Option<Value>,
}

impl TryFrom<Value> for StorageChange {
    type Error = ConversionError;

    fn try_from(value: Value) -> Result<Self, Self::Error> {
        // TODO make this more efficient somehow
        fn lookup<A, B>(input: A, key: &str) -> Option<B>
            where A: JsSerialize,
                  B: TryFrom<Value> + 'static,
                  // TODO this is a bit gross
                  B::Error: ::std::fmt::Debug {

            let value = js!(
                var obj = @{input};
                var key = @{key};

                if ({}.hasOwnProperty.call(obj, key)) {
                    return [obj[key]];

                } else {
                    return null;
                }
            );

            // TODO is this correct ?
            match value {
                Value::Null => None,
                a => Some(js!( return @{a}[0]; ).try_into().unwrap()),
            }
        }



        match value {
            Value::Reference(reference) => {
                Ok(StorageChange {
                    old_value: match js!( return @{&reference}.oldValue; ) {
                        Value::Undefined => None,
                        a => Some(a),
                    },

                    new_value: match js!( return @{&reference}.newValue; ) {
                        Value::Undefined => None,
                        a => Some(a),
                    },
                })
            },
            // TODO use ConversionError::type_mismatch(&value)
            _ => Err(ConversionError::Custom("Wrong type".to_owned()))
        }
    }
}


#[derive(Debug, Clone, Copy)]
pub enum StorageAreaType {
    Sync,
    Local,
    Managed,
}

impl TryFrom<Value> for StorageAreaType {
    type Error = ConversionError;

    fn try_from(value: Value) -> Result<Self, Self::Error> {
        match value {
            Value::String(string) => match string.as_str() {
                "sync" => Ok(StorageAreaType::Sync),
                "local" => Ok(StorageAreaType::Local),
                "managed" => Ok(StorageAreaType::Managed),
                _ => Err(ConversionError::Custom("Expected \"sync\", \"local\", or \"managed\"".to_owned())),
            },
            // TODO use ConversionError::type_mismatch(&value)
            _ => Err(ConversionError::Custom("Wrong type".to_owned()))
        }
    }
}


pub struct OnChange(Value);

impl Discard for OnChange {
    fn discard(self) {
        js! { @(no_return)
            var callback = @{self.0};
            browser.storage.onChanged.removeListener(callback);
            callback.drop();
        }
    }
}

// TODO use HashMap instead ?
pub fn on_change<F>(f: F) -> DiscardOnDrop<OnChange>
    where F: FnMut(BTreeMap<String, StorageChange>, StorageAreaType) + 'static {
    DiscardOnDrop::new(OnChange(js!(
        var callback = @{f};
        browser.storage.onChanged.addListener(callback);
        return callback;
    )))
}
