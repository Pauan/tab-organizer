use {DRAG_ANIMATION_DURATION, INSERT_ANIMATION_DURATION, GROUP_BORDER_WIDTH, GROUP_PADDING_TOP, GROUP_HEADER_HEIGHT, GROUP_PADDING_BOTTOM, TAB_PADDING, TAB_HEIGHT, TAB_BORDER_WIDTH, ease};
use std::ops::Deref;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use tab_organizer::state;
use uuid::Uuid;
use futures_signals::signal::{Signal, Mutable};
use futures_signals::signal_vec::MutableVec;
use dominator::animation::{MutableAnimation, Percentage};


pub(crate) struct TabState {
    pub(crate) id: Uuid,
    pub(crate) favicon_url: Mutable<Option<Arc<String>>>,
    pub(crate) title: Mutable<Option<Arc<String>>>,
    pub(crate) url: Mutable<Option<Arc<String>>>,
    pub(crate) focused: Mutable<bool>,
    pub(crate) unloaded: Mutable<bool>,
    pub(crate) pinned: Mutable<bool>,
}

impl TabState {
    pub(crate) fn new(state: state::Tab) -> Self {
        Self {
            id: state.serialized.id,
            favicon_url: Mutable::new(state.favicon_url.map(Arc::new)),
            title: Mutable::new(state.title.map(Arc::new)),
            url: Mutable::new(state.url.map(Arc::new)),
            focused: Mutable::new(state.focused),
            unloaded: Mutable::new(state.unloaded),
            pinned: Mutable::new(state.pinned),
        }
    }
}


pub(crate) struct Tab {
    pub(crate) state: Arc<TabState>,

    pub(crate) selected: Mutable<bool>,
    pub(crate) dragging: Mutable<bool>,

    pub(crate) hovered: Mutable<bool>,
    pub(crate) holding: Mutable<bool>,

    pub(crate) close_hovered: Mutable<bool>,
    pub(crate) close_holding: Mutable<bool>,

    pub(crate) matches_search: Mutable<bool>,

    pub(crate) removing: Mutable<bool>,
    pub(crate) visible: Mutable<bool>,

    pub(crate) drag_over: MutableAnimation,
    pub(crate) insert_animation: MutableAnimation,
}

impl Tab {
    pub(crate) fn new(state: Arc<TabState>) -> Self {
        Self {
            state,

            selected: Mutable::new(false),
            dragging: Mutable::new(false),

            hovered: Mutable::new(false),
            holding: Mutable::new(false),

            close_hovered: Mutable::new(false),
            close_holding: Mutable::new(false),

            matches_search: Mutable::new(false),

            removing: Mutable::new(false),
            visible: Mutable::new(false),

            drag_over: MutableAnimation::new(DRAG_ANIMATION_DURATION),
            insert_animation: MutableAnimation::new_with_initial(INSERT_ANIMATION_DURATION, Percentage::new(1.0)),
        }
    }

    // TODO hacky
    pub(crate) fn height(&self) -> f64 {
        // TODO use range_inclusive ?
        let percentage = ease(self.insert_animation.current_percentage()).into_f64();

        (TAB_BORDER_WIDTH * percentage).round() +
        (TAB_PADDING * percentage).round() +
        (TAB_HEIGHT * percentage).round() +
        (TAB_PADDING * percentage).round() +
        (TAB_BORDER_WIDTH * percentage).round()
    }

    pub(crate) fn insert_animate(&self) {
        // TODO what if the tab is in multiple groups ?
        self.insert_animation.jump_to(Percentage::new(0.0));
        self.insert_animation.animate_to(Percentage::new(1.0));
    }

    pub(crate) fn remove_animate(&self) {
        self.removing.set_neq(true);
        self.insert_animation.animate_to(Percentage::new(0.0));
    }

    pub(crate) fn is_inserted(this: &Arc<Self>) -> bool {
        !this.removing.get()
    }

    pub(crate) fn is_focused(&self) -> impl Signal<Item = bool> {
        self.focused.signal()
    }
}

impl Deref for Tab {
    type Target = TabState;

    #[inline]
    fn deref(&self) -> &Self::Target {
        &*self.state
    }
}


pub(crate) struct Window {
    pub(crate) id: Uuid,
    pub(crate) name: Mutable<Option<Arc<String>>>,
    pub(crate) tabs: Vec<Arc<TabState>>,
}

impl Window {
    pub(crate) fn new(state: state::Window) -> Self {
        Self {
            id: state.serialized.id,
            name: Mutable::new(state.serialized.name.map(Arc::new)),
            tabs: state.tabs.into_iter().map(|tab| Arc::new(TabState::new(tab))).collect(),
        }
    }

    // TODO make this more efficient (e.g. returning Iterator)
    pub(crate) fn get_tabs(&self) -> Vec<Arc<Tab>> {
        self.tabs.iter().cloned().map(Tab::new).map(Arc::new).collect()
    }
}


pub(crate) struct Group {
    pub(crate) id: usize,
    pub(crate) name: Mutable<Option<Arc<String>>>,
    pub(crate) tabs: MutableVec<Arc<Tab>>,

    pub(crate) show_header: bool,

    pub(crate) insert_animation: MutableAnimation,
    pub(crate) removing: Mutable<bool>,
    pub(crate) visible: Mutable<bool>,

    pub(crate) matches_search: Mutable<bool>,

    pub(crate) last_selected_tab: Mutable<Option<Uuid>>,

    pub(crate) drag_over: MutableAnimation,
    pub(crate) drag_top: MutableAnimation,
    pub(crate) tabs_padding: Mutable<f64>, // TODO use u32 instead ?
}

impl Group {
    pub(crate) fn new(show_header: bool, name: Mutable<Option<Arc<String>>>, tabs: Vec<Arc<Tab>>) -> Self {
        lazy_static! {
            static ref ID_COUNTER: AtomicUsize = AtomicUsize::new(0);
        }

        Self {
            // TODO investigate whether it's possible to use a faster Ordering
            id: ID_COUNTER.fetch_add(1, Ordering::SeqCst),
            name,
            tabs: MutableVec::new_with_values(tabs),
            show_header,
            drag_over: MutableAnimation::new(DRAG_ANIMATION_DURATION),
            drag_top: MutableAnimation::new(DRAG_ANIMATION_DURATION),
            insert_animation: MutableAnimation::new_with_initial(INSERT_ANIMATION_DURATION, Percentage::new(1.0)),
            last_selected_tab: Mutable::new(None),
            matches_search: Mutable::new(false),
            removing: Mutable::new(false),
            visible: Mutable::new(false),
            tabs_padding: Mutable::new(0.0),
        }
    }

    // TODO hacky
    // TODO what about when it's dragging ?
    pub(crate) fn height(&self) -> (f64, f64) {
        // TODO use range_inclusive
        let percentage = ease(self.insert_animation.current_percentage()).into_f64();

        (
            (GROUP_BORDER_WIDTH * percentage).round() +
            (GROUP_PADDING_TOP * percentage).round() +
            (if self.show_header { (GROUP_HEADER_HEIGHT * percentage).round() } else { 0.0 }),

            (GROUP_PADDING_BOTTOM * percentage).round()
        )
    }

    pub(crate) fn insert_animate(&self) {
        self.insert_animation.jump_to(Percentage::new(0.0));
        self.insert_animation.animate_to(Percentage::new(1.0));
    }

    pub(crate) fn remove_animate(&self) {
        self.removing.set_neq(true);
        self.insert_animation.animate_to(Percentage::new(0.0));
    }

    pub(crate) fn is_inserted(this: &Arc<Self>) -> bool {
        !this.removing.get()
    }

    pub(crate) fn tabs_each<F>(&self, mut f: F) where F: FnMut(&Tab) {
        let slice = self.tabs.lock_ref();

        for tab in slice.iter() {
            f(&tab);
        }
    }

    pub(crate) fn update_dragging_tabs<F>(&self, tab_index: Option<usize>, mut f: F) where F: FnMut(&Tab, Percentage) {
        let slice = self.tabs.lock_ref();

        if let Some(tab_index) = tab_index {
            let mut seen = false;

            for (index, tab) in slice.iter().enumerate() {
                let percentage = if index == tab_index {
                    seen = true;
                    Percentage::new(1.0)

                } else if seen {
                    Percentage::new(1.0)

                } else {
                    Percentage::new(0.0)
                };

                f(&tab, percentage);
            }

        } else {
            for tab in slice.iter() {
                f(&tab, Percentage::new(0.0));
            }
        }
    }

    pub(crate) fn click_tab(&self, tab: &Tab) {
        if !tab.selected.get() {
            {
                let tabs = self.tabs.lock_ref();

                for tab in tabs.iter() {
                    tab.selected.set_neq(false);
                }
            }

            self.last_selected_tab.set_neq(None);
        }
    }

    pub(crate) fn ctrl_select_tab(&self, tab: &Arc<Tab>) {
        let mut selected = tab.selected.lock_mut();

        *selected = !*selected;

        if *selected {
            self.last_selected_tab.set_neq(Some(tab.id));

        } else {
            self.last_selected_tab.set_neq(None);
        }
    }

    pub(crate) fn shift_select_tab(&self, tab: &Arc<Tab>) {
        let mut last_selected_tab = self.last_selected_tab.lock_mut();

        let selected = if let Some(last_selected_tab) = *last_selected_tab {
            let tabs = self.tabs.lock_ref();
            let mut seen = false;

            for x in tabs.iter() {
                if x.id == last_selected_tab ||
                   x.id == tab.id {
                    x.selected.set_neq(true);

                    if tab.id != last_selected_tab {
                        seen = !seen;
                    }

                } else if seen {
                    x.selected.set_neq(true);

                } else {
                    x.selected.set_neq(false);
                }
            }

            true

        } else {
            false
        };

        if !selected {
            tab.selected.set_neq(true);
            *last_selected_tab = Some(tab.id);
        }
    }
}
