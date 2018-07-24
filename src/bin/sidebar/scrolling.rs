use {TOOLBAR_TOTAL_HEIGHT, MOUSE_SCROLL_SPEED, MOUSE_SCROLL_THRESHOLD};
use tab_organizer::normalize;
use stdweb;
use state::State;
use dominator::animation::{easing, Percentage, OnTimestampDiff};


impl State {
	pub(crate) fn start_scrolling(&self, mouse_y: i32) {
        // TODO is there a better way of calculating this ?
        let top = TOOLBAR_TOTAL_HEIGHT;
        let bottom = stdweb::web::window().inner_height() as f64;
        let threshold = MOUSE_SCROLL_THRESHOLD / (bottom - top).abs();
        let percentage = normalize(mouse_y as f64, top, bottom);
        let percentage = percentage - 0.5;
        let sign = percentage.signum();
        let percentage = easing::cubic(Percentage::new(normalize(percentage.abs(), 0.5 - threshold, 0.5))).into_f64() * sign;

        if percentage == 0.0 {
            self.scrolling.on_timestamp_diff.set(None);

        } else {
            let percentage = percentage * MOUSE_SCROLL_SPEED;

            let y = self.scrolling.y.clone();

            // TODO initialize this inside of the OnTimestampDiff callback ?
            let starting_y = y.get();

            self.scrolling.on_timestamp_diff.set(Some(OnTimestampDiff::new(move |diff| {
                y.set_neq(starting_y + (diff * percentage));
            })));
        }
    }
}
