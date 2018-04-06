#[derive(Debug, Serialize, Deserialize)]
pub struct State {
    foo: f64
}

impl State {
    pub fn new() -> Self {
        Self {
            foo: 0.0,
        }
    }
}
