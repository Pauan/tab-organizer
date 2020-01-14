use std::pin::Pin;
use std::marker::Unpin;
use std::sync::Arc;
use tab_organizer::{time, ease, window_width};
use tab_organizer::state::SortTabs;
use crate::constants::{DRAG_GAP_PX, TOOLBAR_TOTAL_HEIGHT, GROUP_BORDER_WIDTH, GROUP_PADDING_TOP, GROUP_HEADER_HEIGHT, GROUP_PADDING_BOTTOM, TAB_PINNED_HEIGHT, TOOLBAR_MARGIN, TAB_PADDING, TAB_HEIGHT, TAB_BORDER_WIDTH};
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
        //tab.holding.set_neq(false);
        tab.close_hovered.set_neq(false);
        tab.close_holding.set_neq(false);
        self.unhover_tab(tab);
    }
}


struct CulledTab {
    state: Arc<Tab>,
    drag_over: MutableSink<MutableAnimationSignal>,
    dragging: MutableSink<MutableSignal<bool>>,
    manually_closed: MutableSink<MutableSignal<bool>>,
    insert_animation: MutableSink<MutableAnimationSignal>,
}

impl CulledTab {
    fn new(state: Arc<Tab>) -> Self {
        Self {
            drag_over: MutableSink::new(state.drag_over.signal()),
            dragging: MutableSink::new(state.dragging.signal()),
            manually_closed: MutableSink::new(state.manually_closed.signal()),
            insert_animation: MutableSink::new(state.insert_animation.signal()),
            state,
        }
    }

    fn is_changed(&mut self, cx: &mut Context) -> bool {
        let drag_over = self.drag_over.is_changed(cx);
        let dragging = self.dragging.is_changed(cx);
        let manually_closed = self.manually_closed.is_changed(cx);
        let insert_animation = self.insert_animation.is_changed(cx);

        drag_over ||
        dragging ||
        manually_closed ||
        insert_animation
    }

    // TODO this must be kept in sync with render.rs
    // TODO handle dragging
    fn pinned_width(&self) -> Option<f64> {
        if !self.dragging.unwrap() && !self.manually_closed.unwrap() {
            let percentage = ease(self.insert_animation.unwrap());

            let border = percentage.range_inclusive(0.0, TAB_BORDER_WIDTH).round();
            let padding = percentage.range_inclusive(0.0, TAB_PADDING).round();
            let width = percentage.range_inclusive(0.0, TAB_HEIGHT).round();

            Some(
                (border * 2.0) + (padding * 2.0) + width
            )

        } else {
            None
        }
    }

    // TODO this must be kept in sync with render.rs
    fn height(&self) -> Option<(f64, f64)> {
        // TODO make matches_search a MutableSink ?
        if self.state.matches_search.get() && !self.dragging.unwrap() && !self.manually_closed.unwrap() {
            let percentage = ease(self.insert_animation.unwrap());

            let border = percentage.range_inclusive(0.0, TAB_BORDER_WIDTH).round();
            let padding = percentage.range_inclusive(0.0, TAB_PADDING).round();
            let height = percentage.range_inclusive(0.0, TAB_HEIGHT).round();

            Some((
                // Offset top
                ease(self.drag_over.unwrap()).range_inclusive(0.0, DRAG_GAP_PX).round(),

                // Height
                (border * 2.0) + (padding * 2.0) + height
            ))

        } else {
            None
        }
    }
}


struct CulledGroup<A> where A: SignalVec {
    state: Arc<Group>,
    tabs: MutableVecSink<A>,
    drag_over: MutableSink<MutableAnimationSignal>,
    insert_animation: MutableSink<MutableAnimationSignal>,
}

fn culled_group(state: Arc<Group>) -> CulledGroup<impl SignalVec<Item = CulledTab>> {
    let tabs_signal = state.tabs.signal_vec_cloned()
        // TODO duplication with render.rs
        .delay_remove(|tab| tab.wait_until_removed())
        .map(CulledTab::new);

    CulledGroup {
        tabs: MutableVecSink::new(tabs_signal),
        drag_over: MutableSink::new(state.drag_over.signal()),
        insert_animation: MutableSink::new(state.insert_animation.signal()),
        state,
    }
}

impl<A> CulledGroup<A> where A: SignalVec<Item = CulledTab> + Unpin {
    fn is_changed(&mut self, cx: &mut Context) -> bool {
        let tabs = self.tabs.is_changed(cx, |cx, tab| tab.is_changed(cx));
        let drag_over = self.drag_over.is_changed(cx);
        let insert_animation = self.insert_animation.is_changed(cx);

        tabs ||
        drag_over ||
        insert_animation
    }

    // TODO this must be kept in sync with render.rs
    // There is no offset, because the group list has `top: 1px` and the groups have `top: -1px` so it cancels out
    fn height(&self) -> Option<(f64, f64)> {
        if self.state.matches_search.get() {
            let percentage = ease(self.insert_animation.unwrap());
            let drag_over = ease(self.drag_over.unwrap());

            Some((
                // Height top
                percentage.range_inclusive(0.0, GROUP_BORDER_WIDTH).round() +
                percentage.range_inclusive(0.0, GROUP_PADDING_TOP).round() +
                (if self.state.show_header {
                    percentage.range_inclusive(0.0, GROUP_HEADER_HEIGHT).round()
                } else {
                    0.0
                }),

                // Height bottom
                percentage.range_inclusive(0.0, GROUP_PADDING_BOTTOM).round() +
                drag_over.range_inclusive(0.0, DRAG_GAP_PX).round()
            ))

        } else {
            None
        }
    }
}


struct Culler<A, B, C, D> where A: SignalVec, B: Signal, C: Signal, D: SignalVec {
    first: bool,
    state: Arc<State>,
    groups: MutableVecSink<A>,
    search_parser: MutableSink<MutableSignalCloned<Arc<search::Parsed>>>,
    sort_tabs: MutableSink<MutableSignal<SortTabs>>,
    scroll_y: MutableSink<B>,
    window_height: MutableSink<C>,
    pinned: CulledGroup<D>,
}

impl<A, B, C, D, E> Culler<A, C, D, E>
    where A: SignalVec<Item = CulledGroup<B>> + Unpin,
          B: SignalVec<Item = CulledTab> + Unpin,
          C: Signal<Item = f64> + Unpin,
          D: Signal<Item = f64> + Unpin,
          E: SignalVec<Item = CulledTab> + Unpin {

    fn is_changed(&mut self, cx: &mut Context) -> (bool, bool) {
        let sort_tabs = self.sort_tabs.is_changed(cx);

        // This must be before groups
        // TODO is it guaranteed that groups will synchronously update ?
        if sort_tabs {
            // TODO a little hacky
            if self.first {
                self.first = false;

            } else {
                time!("Changing sort", {
                    self.state.change_sort(self.sort_tabs.unwrap());
                });
            }
        }

        let pinned = self.pinned.is_changed(cx);
        let groups = self.groups.is_changed(cx, |cx, group| group.is_changed(cx));
        let scroll_y = self.scroll_y.is_changed(cx);
        let window_height = self.window_height.is_changed(cx);

        let search_parser = self.search_parser.is_changed(cx);

        (
            pinned ||
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
        // TODO take into account the animations ?
        let pinned_height = {
            let window_width = window_width() - (TOOLBAR_MARGIN * 2.0);

            let mut rows = 1.0;
            let mut right = 0.0;
            let mut visible = 0.0;

            for tab in self.pinned.tabs.values.iter() {
                if let Some(width) = tab.pinned_width() {
                    if width > 0.0 {
                        right += width;

                        if right > window_width {
                            right = width;
                            rows += 1.0;
                        }

                        visible += 1.0;
                        tab.state.visible.set_neq(true);

                    } else {
                        self.state.hide_tab(&tab.state);
                    }

                } else {
                    self.state.hide_tab(&tab.state);
                }
            }

            if visible != 0.0 {
                self.pinned.state.visible.set_neq(true);

                let height = rows * TAB_PINNED_HEIGHT;
                TOOLBAR_MARGIN + height

            } else {
                self.pinned.state.visible.set_neq(false);

                0.0
            }
        };

        // TODO is this floor correct ?
        let top_y = self.scroll_y.unwrap().floor();
        // TODO is this ceil correct ?
        let bottom_y = top_y + (self.window_height.unwrap().ceil() - TOOLBAR_TOTAL_HEIGHT - pinned_height);

        let mut padding: Option<f64> = None;
        let mut current_height: f64 = 0.0;

        for group in self.groups.values.iter() {
            if should_search {
                let search_parser = self.search_parser.as_ref();

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

            if let Some((top_height, bottom_height)) = group.height() {
                let old_height = current_height;

                let mut tabs_padding: Option<f64> = None;

                current_height += top_height;

                let tabs_height = current_height;

                // TODO what if there aren't any tabs in the group ?
                for tab in group.tabs.values.iter() {
                    if let Some((offset, height)) = tab.height() {
                        let old_height = current_height;

                        current_height += height;

                        let tab_top = old_height + offset;
                        let tab_bottom = current_height + offset;

                        if tab_bottom > tab_top && tab_top < bottom_y && tab_bottom > top_y {
                            if let None = tabs_padding {
                                // This must not use the offset
                                tabs_padding = Some(old_height - tabs_height);
                            }

                            tab.state.visible.set_neq(true);

                        } else {
                            self.state.hide_tab(&tab.state);
                        }

                    } else {
                        self.state.hide_tab(&tab.state);
                    }
                }

                let tabs_height = current_height - tabs_height;

                current_height += bottom_height;

                // TODO what if the group has height but the tabs don't ?
                // TODO what if the tabs have height but the group doesn't ?
                if current_height > old_height && old_height < bottom_y && current_height > top_y {
                    if let None = padding {
                        padding = Some(old_height);
                    }

                    group.state.tabs_padding.set_neq(tabs_padding.unwrap_or(tabs_height));
                    group.state.visible.set_neq(true);

                } else {
                    group.state.visible.set_neq(false);
                }

            } else {
                group.state.visible.set_neq(false);
            }
        }

        self.state.groups_padding.set_neq(padding.unwrap_or(0.0));
        self.state.scrolling.height.set_neq(current_height);
    }
}

impl<A, B, C, D> Unpin for Culler<A, B, C, D> where A: SignalVec, B: Signal, C: Signal, D: SignalVec {}

impl<A, B, C, D, E> Future for Culler<A, C, D, E>
    where A: SignalVec<Item = CulledGroup<B>> + Unpin,
          B: SignalVec<Item = CulledTab> + Unpin,
          C: Signal<Item = f64> + Unpin,
          D: Signal<Item = f64> + Unpin,
          E: SignalVec<Item = CulledTab> + Unpin {

    type Output = ();

    fn poll(mut self: Pin<&mut Self>, cx: &mut Context) -> Poll<Self::Output> {
        //time!("Culling", {
            let (changed, should_search) = self.is_changed(cx);

            if changed || should_search {
                self.update(should_search);
            }
        //});

        Poll::Pending
    }
}

pub(crate) fn cull_groups<A>(state: Arc<State>, window_height: A) -> impl Future<Output = ()> where A: Signal<Item = f64> + Unpin {
    Culler {
        first: true,
        pinned: culled_group(state.groups.pinned_group()),
        groups: MutableVecSink::new(state.groups.signal_vec_cloned()
            // TODO duplication with render.rs
            .delay_remove(|group| group.wait_until_removed())
            .map(culled_group)),
        search_parser: MutableSink::new(state.search_parser.signal_cloned()),
        sort_tabs: MutableSink::new(state.options.sort_tabs.signal()),
        scroll_y: MutableSink::new(state.scrolling.y.signal()),
        window_height: MutableSink::new(window_height),
        state,
    }
}
