#[macro_use]
extern crate stdweb;
#[macro_use]
extern crate stdweb_derive;
extern crate serde;
#[macro_use]
extern crate serde_derive;
extern crate discard;

#[macro_use]
mod macros;
pub mod storage;
pub mod windows;

pub mod traits {
    pub use storage::{StorageAreaRead, StorageAreaWrite};
}
