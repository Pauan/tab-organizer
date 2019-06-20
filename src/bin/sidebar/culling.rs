use std::pin::Pin;
use std::marker::Unpin;
use std::sync::Arc;
use tab_organizer::ease;
use tab_organizer::state::SortTabs;
use crate::constants::{DRAG_GAP_PX, TOOLBAR_TOTAL_HEIGHT, GROUP_BORDER_WIDTH, GROUP_PADDING_TOP, GROUP_HEADER_HEIGHT, GROUP_PADDING_BOTTOM, TAB_PADDING, TAB_HEIGHT, TAB_BORDER_WIDTH};
use crate::types::{State, Group, Tab};
use crate::search;
use dominator::animation::MutableAnimationSignal;
use futures::{Future, Poll};
use futures::task::Context;
use futures_signals::signal::{Signal, SignalExt, MutableSignal, MutableSignalCloned};
use futures_signals::signal_vec::{SignalVec, SignalVecExt, VecDiff};


struct MutableSink<A> where A: Signal {
    signal: Option<A>,
    value: Option<A::Item>,
}

impl<A> MutableSink<A> where A: Signal + Unpin {
    fn new(signal: A) -> Self {
        Self {
            signal: Some(signal),
            value: None,
        }
    }

    fn unwrap(&self) -> A::Item where A::Item: Copy {
        self.value.unwrap()
    }

    fn is_changed(&mut self, cx: &mut Context) -> bool {
        let mut changed = false;

        loop {
            match self.signal.as_mut().map(|signal| signal.poll_change_unpin(cx)) {
                Some(Poll::Ready(Some(value))) => {
                    self.value = Some(value);
                    changed = true;
                    continue;
                },
                Some(Poll::Ready(None)) => {
                    self.signal = None;
                },
                Some(Poll::Pending) => {},
                None => {},
            }

            return changed;
        }
    }
}

impl<A> AsRef<A::Item> for MutableSink<A> where A: Signal {
    fn as_ref(&self) -> &A::Item {
        self.value.as_ref().unwrap()
    }
}


struct MutableVecSink<A> where A: SignalVec {
    signal: Option<A>,
    values: Vec<A::Item>,
}

impl<A> MutableVecSink<A> where A: SignalVec + Unpin {
    fn new(signal: A) -> Self {
        Self {
            signal: Some(signal),
            values: vec![],
        }
    }

    fn is_changed<F>(&mut self, cx: &mut Context, mut f: F) -> bool where F: FnMut(&mut Context, &mut A::Item) -> bool {
        let mut changed = false;

        loop {
            match self.signal.as_mut().map(|signal| signal.poll_vec_change_unpin(cx)) {
                Some(Poll::Ready(Some(change))) => {
                    changed = true;

                    // TODO move this into futures_signals crate
                    match change {
                        VecDiff::Replace { values } => {
                            self.values = values;
                        },
                        VecDiff::InsertAt { index, value } => {
                            self.values.insert(index, value);
                        },
                        VecDiff::UpdateAt { index, value } => {
                            self.values[index] = value;
                        },
                        VecDiff::RemoveAt { index } => {
                            self.values.remove(index);
                        },
                        VecDiff::Move { old_index, new_index } => {
                            let value = self.values.remove(old_index);
                            self.values.insert(new_index, value);
                        },
                        VecDiff::Push { value } => {
                            self.values.push(value);
                        },
                        VecDiff::Pop {} => {
                            self.values.pop().unwrap();
                        },
                        VecDiff::Clear {} => {
                            self.values.clear();
                        },
                    }

                    continue;
                },
                Some(Poll::Ready(None)) => {
                    self.signal = None;
                },
                Some(Poll::Pending) => {},
                None => {},
            }

            for value in self.values.iter_mut() {
                if f(cx, value) {
                    changed = true;
                }
            }

            return changed;
        }
    }
}


impl State {
    fn hide_tab(&self, tab: &Tab) {
        tab.visible.set_neq(false);
        tab.holding.set_neq(false);
        tab.close_hovered.set_neq(false);
        tab.close_holding.set_neq(false);
        self.unhover_tab(tab);
    }
}


struct CulledTab {
    state: Arc<Tab>,
    drag_over: MutableSink<MutableAnimationSignal>,
    is_dragging: MutableSink<MutableSignal<bool>>,
    insert_animation: MutableSink<MutableAnimationSignal>,
}

impl CulledTab {
    fn new(state: Arc<Tab>) -> Self {
        Self {
            drag_over: MutableSink::new(state.drag_over.signal()),
            is_dragging: MutableSink::new(state.dragging.signal()),
            insert_animation: MutableSink::new(state.insert_animation.signal()),
            state,
        }
    }

    fn is_changed(&mut self, cx: &mut Context) -> bool {
        let drag_over = self.drag_over.is_changed(cx);
        let is_dragging = self.is_dragging.is_changed(cx);
        let insert_animation = self.insert_animation.is_changed(cx);

        drag_over ||
        is_dragging ||
        insert_animation
    }

    // TODO this must be kept in sync with main.rs
    fn height(&self) -> f64 {
        if self.state.matches_search.get() {
            let percentage = ease(self.insert_animation.unwrap());

            let border = percentage.range_inclusive(0.0, TAB_BORDER_WIDTH).round();
            let padding = percentage.range_inclusive(0.0, TAB_PADDING).round();
            let height = percentage.range_inclusive(0.0, TAB_HEIGHT).round();

            (border * 2.0) + (padding * 2.0) + height

        } else {
            0.0
        }
    }

    // TODO this must be kept in sync with main.rs
    fn drag_height(&self) -> f64 {
        ease(self.drag_over.unwrap()).range_inclusive(0.0, DRAG_GAP_PX).round()
    }
}


struct CulledGroup<A> where A: SignalVec {
    state: Arc<Group>,
    tabs: MutableVecSink<A>,
    insert_animation: MutableSink<MutableAnimationSignal>,
}

impl<A> CulledGroup<A> where A: SignalVec<Item = CulledTab> + Unpin {
    fn new(state: Arc<Group>, tabs_signal: A) -> Self {
        Self {
            tabs: MutableVecSink::new(tabs_signal),
            insert_animation: MutableSink::new(state.insert_animation.signal()),
            state,
        }
    }

    fn is_changed(&mut self, cx: &mut Context) -> bool {
        let tabs = self.tabs.is_changed(cx, |cx, tab| tab.is_changed(cx));
        let insert_animation = self.insert_animation.is_changed(cx);

        tabs ||
        insert_animation
    }

    // TODO hacky
    // TODO what about when it's dragging ?
    fn height(&self) -> (f64, f64) {
        if self.state.matches_search.get() {
            // TODO use range_inclusive
            let percentage = ease(self.insert_animation.unwrap()).into_f64();

            (
                (GROUP_BORDER_WIDTH * percentage).round() +
                (GROUP_PADDING_TOP * percentage).round() +
                (if self.state.show_header { (GROUP_HEADER_HEIGHT * percentage).round() } else { 0.0 }),

                (GROUP_PADDING_BOTTOM * percentage).round()
            )

        } else {
            (0.0, 0.0)
        }
    }
}


struct Culler<A, B, C> where A: SignalVec, B: Signal, C: Signal {
    state: Arc<State>,
    groups: MutableVecSink<A>,
    search_parser: MutableSink<MutableSignalCloned<Arc<search::Parsed>>>,
    sort_tabs: MutableSink<MutableSignal<SortTabs>>,
    scroll_y: MutableSink<B>,
    window_height: MutableSink<C>,
}

impl<A, B, C, D> Culler<A, C, D>
    where A: SignalVec<Item = CulledGroup<B>> + Unpin,
          B: SignalVec<Item = CulledTab> + Unpin,
          C: Signal<Item = f64> + Unpin,
          D: Signal<Item = f64> + Unpin {

    fn is_changed(&mut self, cx: &mut Context) -> (bool, bool) {
        let groups = self.groups.is_changed(cx, |cx, group| group.is_changed(cx));
        let scroll_y = self.scroll_y.is_changed(cx);
        let window_height = self.window_height.is_changed(cx);

        let search_parser = self.search_parser.is_changed(cx);
        let sort_tabs = self.sort_tabs.is_changed(cx);

        (
            groups ||
            scroll_y ||
            window_height,

            search_parser ||
            sort_tabs
        )
    }

    // TODO debounce this ?
    // TODO make this simpler somehow ?
    // TODO add in stuff to handle tab dragging
    fn update(&mut self, should_search: bool) {
        let search_parser = self.search_parser.as_ref();

        // TODO is this floor correct ?
        let top_y = self.scroll_y.unwrap().floor();
        // TODO is this ceil correct ?
        let bottom_y = top_y + (self.window_height.unwrap().ceil() - TOOLBAR_TOTAL_HEIGHT);

        let mut padding: Option<f64> = None;
        let mut current_height: f64 = 0.0;

        let mut tabs = 0;

        for group in self.groups.values.iter() {
            // TODO should this be in total, rather than per group ?
            let mut seen_dragging = false;

            if should_search {
                let mut group_matches = false;

                // TODO figure out a way to merge this with the other tabs loop
                for tab in group.tabs.values.iter() {
                    let tab_matches = search_parser.matches_tab(&tab.state);

                    tab.state.set_matches_search(tab_matches);

                    if tab_matches {
                        group_matches = true;
                    }
                }

                group.state.set_matches_search(group_matches);
            }

            let old_height = current_height;

            let mut tabs_padding: Option<f64> = None;

            let (top_height, bottom_height) = group.height();

            current_height += top_height;

            let tabs_height = current_height;

            // TODO what if there aren't any tabs in the group ?
            for tab in group.tabs.values.iter() {
                tabs += 1;

                // TODO is this correct ?
                if !tab.is_dragging.unwrap() {
                    let old_height = current_height;

                    current_height += tab.height();

                    if current_height > old_height && old_height < bottom_y && current_height > top_y {
                        if let None = tabs_padding {
                            tabs_padding = Some(old_height);
                        }

                        tab.state.visible.set_neq(true);

                    } else {
                        self.state.hide_tab(&tab.state);
                    }

                } else {
                    // TODO super hacky
                    // TODO is this correct ?
                    if !seen_dragging {
                        seen_dragging = true;
                        current_height += tab.drag_height();
                    }

                    self.state.hide_tab(&tab.state);
                }
            }

            let no_tabs_height = current_height;

            current_height += bottom_height;

            // TODO what if the group has height but the tabs don't ?
            // TODO what if the tabs have height but the group doesn't ?
            if current_height > old_height && old_height < bottom_y && current_height > top_y {
                if let None = padding {
                    padding = Some(old_height);
                }

                group.state.tabs_padding.set_neq(tabs_padding.unwrap_or(no_tabs_height) - tabs_height);
                group.state.visible.set_neq(true);

            } else {
                group.state.visible.set_neq(false);
            }
        }

        log!("{}", tabs);

        self.state.groups_padding.set_neq(padding.unwrap_or(0.0));
        self.state.scrolling.height.set_neq(current_height);
    }
}

impl<A, B, C> Unpin for Culler<A, B, C> where A: SignalVec, B: Signal, C: Signal {}

impl<A, B, C, D> Future for Culler<A, C, D>
    where A: SignalVec<Item = CulledGroup<B>> + Unpin,
          B: SignalVec<Item = CulledTab> + Unpin,
          C: Signal<Item = f64> + Unpin,
          D: Signal<Item = f64> + Unpin {

    type Output = ();

    fn poll(mut self: Pin<&mut Self>, cx: &mut Context) -> Poll<Self::Output> {
        time!("Culling", {
            let (changed, should_search) = self.is_changed(cx);

            if changed || should_search {
                self.update(should_search);
            }
        });

        Poll::Pending
    }
}

pub(crate) fn cull_groups<A>(state: Arc<State>, window_height: A) -> impl Future<Output = ()> where A: Signal<Item = f64> + Unpin {
    Culler {
        groups: MutableVecSink::new(state.groups.signal_vec_cloned()
            // TODO duplication with main.rs
            .delay_remove(|group| group.wait_until_removed())
            .map(|group| {
                let tabs = group.tabs.signal_vec_cloned()
                    // TODO duplication with main.rs
                    .delay_remove(|tab| tab.wait_until_removed())
                    .map(CulledTab::new);
                CulledGroup::new(group, tabs)
            })),
        search_parser: MutableSink::new(state.search_parser.signal_cloned()),
        sort_tabs: MutableSink::new(state.options.sort_tabs.signal()),
        scroll_y: MutableSink::new(state.scrolling.y.signal()),
        window_height: MutableSink::new(window_height),
        state,
    }
}
