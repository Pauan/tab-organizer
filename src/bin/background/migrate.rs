use serde_json;
use web_extensions;
use stdweb::web::error::Error;
use state::State;
use futures::prelude::{async, await};
use futures::Future;
use web_extensions::traits::*;


const CURRENT_VERSION: f64 = 1522565050166.0;


#[async]
pub fn initialize() -> Result<State, Error> {
    // TODO make this more efficient
    let (serialized, version): (Option<String>, Option<f64>) = await!(
        web_extensions::storage::Local.get("state").join(
        web_extensions::storage::Local.get("version"))
    )?;

    let version = version.unwrap_or(0.0);

    if version != CURRENT_VERSION {
        if serialized.is_some() {
            // migrate code goes here
        }

        await!(web_extensions::storage::Local.set("version", CURRENT_VERSION))?;
    }

    let state = serialized.as_ref().map(|x| serde_json::from_str(x).unwrap()).unwrap_or_else(State::new);

    Ok(state)
}
