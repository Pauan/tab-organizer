use url_bar;
use types::{State, Tab};
use std::sync::Arc;
use futures_signals::signal::{Signal, and, not};


impl State {
	pub(crate) fn is_tab_hovered(&self, tab: &Tab) -> impl Signal<Item = bool> {
        and(tab.hovered.signal(), not(self.is_dragging()))
    }

    pub(crate) fn is_tab_holding(&self, tab: &Tab) -> impl Signal<Item = bool> {
        and(
            and(self.is_tab_hovered(tab), tab.holding.signal()),
            // TODO a little bit hacky
            not(tab.close_hovered.signal())
        )
    }

    pub(crate) fn hover_tab(&self, tab: &Tab) {
        if !tab.hovered.get() {
            tab.hovered.set(true);

            let url = tab.url.lock_ref();

            self.url_bar.set(url.as_ref().and_then(|url| {
                url_bar::UrlBar::new(&url).map(|x| Arc::new(x.minify()))
            }));
        }
    }

    pub(crate) fn unhover_tab(&self, tab: &Tab) {
        if tab.hovered.get() {
            tab.hovered.set(false);

            self.url_bar.set(None);
        }
    }
}
