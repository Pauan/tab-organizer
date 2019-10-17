use crate::types::{State, Tab};
use futures_signals::signal::{Signal, and, not};


impl State {
	pub(crate) fn is_tab_hovered(&self, tab: &Tab) -> impl Signal<Item = bool> {
        and(tab.hovered.signal(), not(self.is_dragging()))
    }

    /*pub(crate) fn is_tab_holding(&self, tab: &Tab) -> impl Signal<Item = bool> {
        and(
            and(self.is_tab_hovered(tab), tab.holding.signal()),
            // TODO a little bit hacky
            not(tab.close_hovered.signal())
        )
    }*/

    pub(crate) fn hover_tab(&self, tab: &Tab) {
        if !tab.hovered.get() {
            tab.hovered.set(true);

            let url_bar = tab.url_bar.lock_ref();
            self.url_bar.set(url_bar.clone());
        }
    }

    pub(crate) fn unhover_tab(&self, tab: &Tab) {
        if tab.hovered.get() {
            tab.hovered.set(false);

            self.url_bar.set(None);
        }
    }
}
