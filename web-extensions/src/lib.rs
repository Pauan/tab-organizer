#[macro_use]
extern crate stdweb;
extern crate discard;

pub mod storage;

pub mod traits {
	pub use storage::{StorageAreaRead, StorageAreaWrite};
}
