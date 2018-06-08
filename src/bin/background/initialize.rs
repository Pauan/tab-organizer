use std::rc::Rc;
use std::cell::RefCell;
use futures::prelude::*;
use stdweb::web::error::Error;
use state::State;
use migrate;


#[async]
pub fn initialize() -> Result<(), Error> {
	let a = migrate::initialize();
	let b = State::get_windows_info();

    let (serialized, windows) = await!(a.join(b))?;

    let state = Rc::new(RefCell::new(State::new(serialized)));

    let borrow = state.borrow_mut();

    borrow.initialize_windows(windows);

    log!("{:#?}", state);

    Ok(())
}
