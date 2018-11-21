use std::pin::{Pin, Unpin};
use std::sync::Arc;
use tab_organizer::ease;
use crate::constants::{DRAG_GAP_PX, TOOLBAR_TOTAL_HEIGHT, GROUP_BORDER_WIDTH, GROUP_PADDING_TOP, GROUP_HEADER_HEIGHT, GROUP_PADDING_BOTTOM, TAB_PADDING, TAB_HEIGHT, TAB_BORDER_WIDTH};
use crate::types::{State, Group, Tab};
use dominator::animation::MutableAnimationSignal;
use futures::{Future, Poll};
use futures::task::LocalWaker;
use futures_signals::signal::{Signal, SignalExt, MutableSignal};
use futures_signals::signal_vec::{SignalVec, SignalVecExt, VecDiff};


struct MutableSink<A> where A: Signal {
    signal: Option<A>,
    value: Option<A::Item>,
}

impl<A> MutableSink<A> where A: Signal + Unpin, A::Item: Copy {
    fn new(signal: A) -> Self {
        Self {
            signal: Some(signal),
            value: None,
        }
    }

    fn value(&self) -> A::Item {
        self.value.unwrap()
    }

    fn is_changed(&mut self, waker: &LocalWaker) -> bool {
        let mut changed = false;

        loop {
            match self.signal.as_mut().map(|signal| signal.poll_change_unpin(waker)) {
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

    fn is_changed<F>(&mut self, waker: &LocalWaker, mut f: F) -> bool where F: FnMut(&mut A::Item) -> bool {
        let mut changed = false;

        loop {
            match self.signal.as_mut().map(|signal| signal.poll_vec_change_unpin(waker)) {
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
                if f(value) {
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
    is_dragging: MutableSink<MutableSignal<bool>>,
    matches_search: MutableSink<MutableSignal<bool>>,
    insert_animation: MutableSink<MutableAnimationSignal>,
}

impl CulledTab {
    fn new(state: Arc<Tab>) -> Self {
        Self {
            is_dragging: MutableSink::new(state.dragging.signal()),
            insert_animation: MutableSink::new(state.insert_animation.signal()),
            matches_search: MutableSink::new(state.matches_search.signal()),
            state,
        }
    }

    fn is_changed(&mut self, waker: &LocalWaker) -> bool {
        let is_dragging = self.is_dragging.is_changed(waker);
        let matches_search = self.matches_search.is_changed(waker);
        let insert_animation = self.insert_animation.is_changed(waker);

        is_dragging ||
        matches_search ||
        insert_animation
    }

    // TODO hacky
    fn height(&self) -> f64 {
        if self.matches_search.value() {
            // TODO use range_inclusive ?
            let percentage = ease(self.insert_animation.value()).into_f64();

            (TAB_BORDER_WIDTH * percentage).round() +
            (TAB_PADDING * percentage).round() +
            (TAB_HEIGHT * percentage).round() +
            (TAB_PADDING * percentage).round() +
            (TAB_BORDER_WIDTH * percentage).round()

        } else {
            0.0
        }
    }
}


struct CulledGroup<A> where A: SignalVec {
    state: Arc<Group>,
    tabs: MutableVecSink<A>,
    matches_search: MutableSink<MutableSignal<bool>>,
    insert_animation: MutableSink<MutableAnimationSignal>,
}

impl<A> CulledGroup<A> where A: SignalVec<Item = CulledTab> + Unpin {
    fn new(state: Arc<Group>, tabs_signal: A) -> Self {
        Self {
            tabs: MutableVecSink::new(tabs_signal),
            insert_animation: MutableSink::new(state.insert_animation.signal()),
            matches_search: MutableSink::new(state.matches_search.signal()),
            state,
        }
    }

    fn is_changed(&mut self, waker: &LocalWaker) -> bool {
        let tabs = self.tabs.is_changed(waker, |tab| tab.is_changed(waker));
        let matches_search = self.matches_search.is_changed(waker);
        let insert_animation = self.insert_animation.is_changed(waker);

        tabs ||
        matches_search ||
        insert_animation
    }

    // TODO hacky
    // TODO what about when it's dragging ?
    fn height(&self) -> (f64, f64) {
        if self.matches_search.value() {
            // TODO use range_inclusive
            let percentage = ease(self.insert_animation.value()).into_f64();

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


struct Culler<A, B, C, D> where A: SignalVec, B: Signal, C: Signal, D: Signal {
    state: Arc<State>,
    groups: MutableVecSink<A>,
    is_dragging: MutableSink<B>,
    scroll_y: MutableSink<C>,
    window_height: MutableSink<D>,
}

impl<A, B, C, D, E> Culler<A, C, D, E>
    where A: SignalVec<Item = CulledGroup<B>> + Unpin,
          B: SignalVec<Item = CulledTab> + Unpin,
          C: Signal<Item = bool> + Unpin,
          D: Signal<Item = f64> + Unpin,
          E: Signal<Item = f64> + Unpin {

    fn is_changed(&mut self, waker: &LocalWaker) -> bool {
        let groups = self.groups.is_changed(waker, |group| group.is_changed(waker));
        let is_dragging = self.is_dragging.is_changed(waker);
        let scroll_y = self.scroll_y.is_changed(waker);
        let window_height = self.window_height.is_changed(waker);

        groups ||
        is_dragging ||
        scroll_y ||
        window_height
    }

    // TODO debounce this ?
    // TODO make this simpler somehow ?
    // TODO add in stuff to handle tab dragging
    fn update(&mut self) {
        let is_dragging = self.is_dragging.value();

        // TODO is this floor correct ?
        let top_y = self.scroll_y.value().floor();
        // TODO is this ceil correct ?
        let bottom_y = top_y + (self.window_height.value().ceil() - TOOLBAR_TOTAL_HEIGHT);

        let mut padding: Option<f64> = None;
        let mut current_height: f64 = 0.0;

        for group in self.groups.values.iter() {
            let old_height = current_height;

            let mut tabs_padding: Option<f64> = None;

            let (top_height, bottom_height) = group.height();

            current_height += top_height;

            let tabs_height = current_height;

            // TODO what if there aren't any tabs in the group ?
            for tab in group.tabs.values.iter() {
                // TODO is this correct ?
                if !tab.is_dragging.value() {
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

        if is_dragging {
            // TODO handle this better somehow ?
            current_height += DRAG_GAP_PX;
        }

        self.state.groups_padding.set_neq(padding.unwrap_or(0.0));
        self.state.scrolling.height.set_neq(current_height);
    }
}

impl<A, B, C, D> Unpin for Culler<A, B, C, D> where A: SignalVec, B: Signal, C: Signal, D: Signal {}

impl<A, B, C, D, E> Future for Culler<A, C, D, E>
    where A: SignalVec<Item = CulledGroup<B>> + Unpin,
          B: SignalVec<Item = CulledTab> + Unpin,
          C: Signal<Item = bool> + Unpin,
          D: Signal<Item = f64> + Unpin,
          E: Signal<Item = f64> + Unpin {

    type Output = ();

    fn poll(mut self: Pin<&mut Self>, waker: &LocalWaker) -> Poll<Self::Output> {
        //time!("Culling", {
            let changed = self.is_changed(waker);

            if changed {
                self.update();
            }
        //});

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
        is_dragging: MutableSink::new(state.is_dragging()),
        scroll_y: MutableSink::new(state.scrolling.y.signal()),
        window_height: MutableSink::new(window_height),
        state,
    }
}
