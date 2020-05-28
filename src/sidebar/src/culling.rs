use std::pin::Pin;
use std::marker::Unpin;
use std::sync::Arc;
use tab_organizer::{time, ease};
use tab_organizer::state::SortTabs;
use crate::constants::{DRAG_GAP_PX, TOOLBAR_TOTAL_HEIGHT, GROUP_BORDER_WIDTH, GROUP_PADDING_TOP, GROUP_HEADER_HEIGHT, GROUP_PADDING_BOTTOM, TAB_BORDER_CROWN_WIDTH, TOOLBAR_MARGIN, TAB_PADDING, TAB_HEIGHT, TAB_BORDER_WIDTH};
use crate::types::{State, Group, Tab, WindowSize};
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
        tab.audio_hovered.set_neq(false);
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
    matches_search: MutableSink<MutableSignal<bool>>,
}

impl CulledTab {
    fn new(state: Arc<Tab>) -> Self {
        Self {
            drag_over: MutableSink::new(state.drag_over.signal()),
            dragging: MutableSink::new(state.dragging.signal()),
            manually_closed: MutableSink::new(state.manually_closed.signal()),
            insert_animation: MutableSink::new(state.insert_animation.signal()),
            matches_search: MutableSink::new(state.matches_search.signal()),
            state,
        }
    }

    fn is_changed(&mut self, cx: &mut Context, should_search: Option<&Arc<search::Parsed>>) -> bool {
        // This must be at the top
        if let Some(parser) = should_search {
            let tab_matches = parser.matches_tab(&self.state);

            self.state.set_matches_search(tab_matches);
        }

        let drag_over = self.drag_over.is_changed(cx);
        let dragging = self.dragging.is_changed(cx);
        let manually_closed = self.manually_closed.is_changed(cx);
        let insert_animation = self.insert_animation.is_changed(cx);
        let matches_search = self.matches_search.is_changed(cx);

        drag_over ||
        dragging ||
        manually_closed ||
        insert_animation ||
        matches_search
    }

    // TODO this must be kept in sync with render.rs
    // TODO handle dragging
    fn pinned_size(&self) -> Option<(f64, f64)> {
        if !self.dragging.unwrap() && !self.manually_closed.unwrap() {
            let percentage = ease(self.insert_animation.unwrap());

            let border_crown = percentage.range_inclusive(0.0, TAB_BORDER_CROWN_WIDTH).round();
            let border = percentage.range_inclusive(0.0, TAB_BORDER_WIDTH).round();
            let padding = percentage.range_inclusive(0.0, TAB_PADDING).round();
            let size = percentage.range_inclusive(0.0, TAB_HEIGHT).round();

            Some((
                // Width
                (border * 2.0) + (padding * 2.0) + size,

                // Height
                border_crown + border + padding + size,
            ))

        } else {
            None
        }
    }

    // TODO this must be kept in sync with render.rs
    fn height(&self) -> Option<(f64, f64)> {
        if self.matches_search.unwrap() && !self.dragging.unwrap() && !self.manually_closed.unwrap() {
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
    fn is_changed(&mut self, cx: &mut Context, should_search: Option<&Arc<search::Parsed>>) -> bool {
        let tabs = self.tabs.is_changed(cx, |cx, tab| tab.is_changed(cx, should_search));
        let drag_over = self.drag_over.is_changed(cx);
        let insert_animation = self.insert_animation.is_changed(cx);

        tabs ||
        drag_over ||
        insert_animation
    }

    // TODO this must be kept in sync with render.rs
    // There is no offset, because the group list has `top: 1px` and the groups have `top: -1px` so it cancels out
    fn height(&self) -> (f64, f64) {
        let percentage = ease(self.insert_animation.unwrap());
        let drag_over = ease(self.drag_over.unwrap());

        (
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
        )
    }
}


struct Culler<A, B, C, D, E> where A: SignalVec, B: Signal, C: Signal, D: SignalVec, E: Signal {
    first: bool,
    state: Arc<State>,
    groups: MutableVecSink<A>,
    search_parser: MutableSink<MutableSignalCloned<Arc<search::Parsed>>>,
    sort_tabs: MutableSink<E>,
    scroll_y: MutableSink<B>,
    window_size: MutableSink<C>,
    pinned: CulledGroup<D>,
}

impl<A, B, C, D, E, F> Culler<A, C, D, E, F>
    where A: SignalVec<Item = CulledGroup<B>> + Unpin,
          B: SignalVec<Item = CulledTab> + Unpin,
          C: Signal<Item = f64> + Unpin,
          D: Signal<Item = WindowSize> + Unpin,
          E: SignalVec<Item = CulledTab> + Unpin,
          F: Signal<Item = SortTabs> + Unpin {

    fn is_changed(&mut self, cx: &mut Context) -> bool {
        let sort_tabs = self.sort_tabs.is_changed(cx);
        let search_parser = self.search_parser.is_changed(cx);

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

        // TODO maybe it doesn't need to search if sort_tabs is true ?
        let should_search = if search_parser || sort_tabs {
            Some(self.search_parser.as_ref())

        } else {
            None
        };

        let pinned = self.pinned.is_changed(cx, should_search);
        let groups = self.groups.is_changed(cx, |cx, group| group.is_changed(cx, should_search));
        let scroll_y = self.scroll_y.is_changed(cx);
        let window_size = self.window_size.is_changed(cx);

        pinned ||
        groups ||
        scroll_y ||
        window_size
    }

    // TODO debounce this ?
    // TODO make this simpler somehow ?
    // TODO add in stuff to handle tab dragging
    fn update(&mut self) {
        let window_size = self.window_size.unwrap();

        // TODO take into account the animations ?
        let pinned_height = {
            let window_width = window_size.width.floor() - (TOOLBAR_MARGIN * 2.0);

            let mut total_height = TOOLBAR_MARGIN;
            let mut max_height = None;
            let mut right = 0.0;
            let mut has_tabs = false;

            for tab in self.pinned.tabs.values.iter() {
                if let Some((width, height)) = tab.pinned_size() {
                    if width > 0.0 || height > 0.0 {
                        right += width;

                        // Overflows to next row
                        if right > window_width {
                            if let Some(max_height) = max_height {
                                total_height += max_height;
                            }

                            right = width;
                            max_height = Some(height);

                        } else {
                            max_height = Some(match max_height {
                                Some(max_height) => max_height.max(height),
                                None => height,
                            });
                        }

                        has_tabs = true;
                        tab.state.visible.set_neq(true);

                    } else {
                        self.state.hide_tab(&tab.state);
                    }

                } else {
                    self.state.hide_tab(&tab.state);
                }
            }

            if has_tabs {
                self.pinned.state.visible.set_neq(true);

                total_height + max_height.unwrap()

            } else {
                self.pinned.state.visible.set_neq(false);

                0.0
            }
        };

        // TODO is this floor correct ?
        let top_y = self.scroll_y.unwrap().floor();
        // TODO is this ceil correct ?
        let bottom_y = top_y + (window_size.height.ceil() - TOOLBAR_TOTAL_HEIGHT - pinned_height);

        let mut padding: Option<f64> = None;
        let mut current_height: f64 = 0.0;

        for group in self.groups.values.iter() {
            let (top_height, bottom_height) = group.height();

            let old_height = current_height;

            let mut tabs_padding: Option<f64> = None;

            current_height += top_height;

            let tabs_height = current_height;

            let mut group_matches_search = false;

            // TODO what if there aren't any tabs in the group ?
            for tab in group.tabs.values.iter() {
                if tab.matches_search.unwrap() {
                    group_matches_search = true;
                }

                if let Some((offset, height)) = tab.height() {
                    if height > 0.0 {
                        let old_height = current_height;

                        current_height += height;

                        let tab_top = old_height + offset;
                        let tab_bottom = current_height + offset;

                        if tab_top < bottom_y && tab_bottom > top_y {
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

                } else {
                    self.state.hide_tab(&tab.state);
                }
            }

            if group_matches_search {
                let tabs_height = current_height - tabs_height;

                current_height += bottom_height;

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
                current_height -= top_height;
                group.state.visible.set_neq(false);
            }
        }

        self.state.groups_padding.set_neq(padding.unwrap_or(0.0));
        self.state.scrolling.height.set_neq(current_height);
    }
}

impl<A, B, C, D, E> Unpin for Culler<A, B, C, D, E> where A: SignalVec, B: Signal, C: Signal, D: SignalVec, E: Signal {}

impl<A, B, C, D, E, F> Future for Culler<A, C, D, E, F>
    where A: SignalVec<Item = CulledGroup<B>> + Unpin,
          B: SignalVec<Item = CulledTab> + Unpin,
          C: Signal<Item = f64> + Unpin,
          D: Signal<Item = WindowSize> + Unpin,
          E: SignalVec<Item = CulledTab> + Unpin,
          F: Signal<Item = SortTabs> + Unpin {

    type Output = ();

    fn poll(mut self: Pin<&mut Self>, cx: &mut Context) -> Poll<Self::Output> {
        //time!("Culling", {
            let changed = self.is_changed(cx);

            if changed {
                self.update();
            }
        //});

        Poll::Pending
    }
}

pub(crate) fn cull_groups(state: Arc<State>) -> impl Future<Output = ()> {
    Culler {
        first: true,
        pinned: culled_group(state.groups.pinned_group()),
        groups: MutableVecSink::new(state.groups.signal_vec_cloned()
            // TODO duplication with render.rs
            .delay_remove(|group| group.wait_until_removed())
            .map(culled_group)),
        search_parser: MutableSink::new(state.search_parser.signal_cloned()),
        sort_tabs: MutableSink::new(state.options.signal_ref(|x| x.sort_tabs)),
        scroll_y: MutableSink::new(state.scrolling.y.signal()),
        window_size: MutableSink::new(state.window_size.signal()),
        state,
    }
}
