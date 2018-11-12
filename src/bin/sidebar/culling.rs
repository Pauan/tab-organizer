use std::pin::{Pin, Unpin};
use std::sync::Arc;
use tab_organizer::ease;
use tab_organizer::state::SortTabs;
use constants::{DRAG_GAP_PX, TOOLBAR_TOTAL_HEIGHT, GROUP_BORDER_WIDTH, GROUP_PADDING_TOP, GROUP_HEADER_HEIGHT, GROUP_PADDING_BOTTOM, TAB_PADDING, TAB_HEIGHT, TAB_BORDER_WIDTH};
use types::{State, DragState, Group, Tab};
use stdweb;
use dominator::animation::{Percentage, MutableAnimationSignal};
use futures::{Future, Poll};
use futures::task::LocalWaker;
use futures_signals::signal::{Signal, SignalExt, MutableSignal, MutableSignalCloned};
use futures_signals::signal_vec::{SignalVec, SignalVecExt, VecDiff};


/*pub(crate) fn delay_animation(animation: &MutableAnimation, visible: &Mutable<bool>) -> impl Future<Item = (), Error = Never> {
    animation.signal().wait_for(Percentage::new(0.0)).select(visible.signal().wait_for(false))
        // TODO a bit gross
        .map(|_| ())
        .map_err(|_| unreachable!())
}*/


fn changed_vec<A, B, C, F>(signal: &mut Option<C>, waker: &LocalWaker, vec: &mut Vec<B>, mut f: F) -> bool
    where C: SignalVec<Item = A> + Unpin,
          F: FnMut(A) -> B {

    let mut changed = false;

    loop {
        match signal.as_mut().map(|signal| signal.poll_vec_change_unpin(waker)) {
            Some(Poll::Ready(Some(change))) => {
                changed = true;

                // TODO move this into futures_signals crate
                match change {
                    VecDiff::Replace { values } => {
                        *vec = values.into_iter().map(|value| f(value)).collect();
                    },
                    VecDiff::InsertAt { index, value } => {
                        vec.insert(index, f(value));
                    },
                    VecDiff::UpdateAt { index, value } => {
                        vec[index] = f(value);
                    },
                    VecDiff::RemoveAt { index } => {
                        vec.remove(index);
                    },
                    VecDiff::Move { old_index, new_index } => {
                        let value = vec.remove(old_index);
                        vec.insert(new_index, value);
                    },
                    VecDiff::Push { value } => {
                        vec.push(f(value));
                    },
                    VecDiff::Pop {} => {
                        vec.pop().unwrap();
                    },
                    VecDiff::Clear {} => {
                        vec.clear();
                    },
                }

                continue;
            },
            Some(Poll::Ready(None)) => {
                *signal = None;
            },
            Some(Poll::Pending) => {},
            None => {},
        }

        return changed;
    }
}

#[inline]
fn changed<A, B>(signal: &mut Option<B>, waker: &LocalWaker) -> bool where B: Signal<Item = A> + Unpin {
    changed_option(signal, waker).is_some()
}

fn changed_option<A, B>(signal: &mut Option<B>, waker: &LocalWaker) -> Option<A> where B: Signal<Item = A> + Unpin {
    let mut changed = None;

    loop {
        match signal.as_mut().map(|signal| signal.poll_change_unpin(waker)) {
            Some(Poll::Ready(Some(value))) => {
                changed = Some(value);
                continue;
            },
            Some(Poll::Ready(None)) => {
                *signal = None;
            },
            Some(Poll::Pending) => {},
            None => {},
        }

        return changed;
    }
}


struct TabState {
    url: Option<MutableSignalCloned<Option<Arc<String>>>>,
    title: Option<MutableSignalCloned<Option<Arc<String>>>>,
    removing: Option<MutableSignal<bool>>,
    dragging: Option<MutableSignal<bool>>,
    insert_animation: Option<MutableAnimationSignal>,
}

impl TabState {
    fn new(tab: Arc<Tab>) -> Self {
        Self {
            url: Some(tab.url.signal_cloned()),
            title: Some(tab.title.signal_cloned()),
            removing: Some(tab.removing.signal()),
            dragging: Some(tab.dragging.signal()),
            insert_animation: Some(tab.insert_animation.signal()),
        }
    }

    fn changed(&mut self, waker: &LocalWaker) -> (bool, bool) {
        let url = changed(&mut self.url, waker);
        let title = changed(&mut self.title, waker);
        let removing = changed(&mut self.removing, waker);
        let dragging = changed(&mut self.dragging, waker);
        let insert_animation = changed(&mut self.insert_animation, waker);
        (
            url || title || removing || dragging || insert_animation,
            url || title
        )
    }
}


struct GroupState<A> {
    signal: Option<A>,
    tabs: Vec<TabState>,
    removing: Option<MutableSignal<bool>>,
    insert_animation: Option<MutableAnimationSignal>,
}

impl<A> GroupState<A> where A: SignalVec<Item = Arc<Tab>> + Unpin {
    fn changed(&mut self, waker: &LocalWaker) -> (bool, bool) {
        let removing = changed(&mut self.removing, waker);
        let insert_animation = changed(&mut self.insert_animation, waker);
        let signal = changed_vec(&mut self.signal, waker, &mut self.tabs, TabState::new);

        let mut tabs = false;
        let mut search = false;

        for mut tab in self.tabs.iter_mut() {
            let x = tab.changed(waker);

            if x.0 {
                tabs = true;
            }

            if x.1 {
                search = true;
            }
        }

        // TODO it should search only when a tab is inserted or updated, not removed
        (
            removing || insert_animation || signal || tabs,
            signal || search
        )
    }
}


struct Waiter<A, B, G, F> where G: FnMut(&Group) -> B {
    signal: Option<A>,
    group_signal: G,
    groups: Vec<GroupState<B>>,
    sort_tabs: Option<MutableSignal<SortTabs>>, // TODO this might be unnecessary
    callback: F,
}

impl<A, B, G, F> Waiter<A, B, G, F>
    where A: SignalVec<Item = Arc<Group>> + Unpin,
          B: SignalVec<Item = Arc<Tab>> + Unpin,
          G: FnMut(&Group) -> B,
          F: FnMut(bool, Option<SortTabs>) {

    fn changed(&mut self, waker: &LocalWaker) -> (bool, bool, Option<SortTabs>) {
        let group_signal = &mut self.group_signal;

        let signal = changed_vec(&mut self.signal, waker, &mut self.groups, |group| {
            GroupState {
                signal: Some(group_signal(&group)),
                tabs: vec![],
                removing: Some(group.removing.signal()),
                insert_animation: Some(group.insert_animation.signal()),
            }
        });

        let mut groups_changed = false;
        let mut groups_searched = false;

        for mut group in self.groups.iter_mut() {
            let (x, y) = group.changed(waker);

            if x {
                groups_changed = true;
            }

            if y {
                groups_searched = true;
            }
        }

        let sort_tabs = changed_option(&mut self.sort_tabs, waker);

        // TODO it should search only when a group is inserted or updated, not removed
        (
            signal || groups_changed || sort_tabs.is_some(),
            signal || groups_searched || sort_tabs.is_some(),
            sort_tabs
        )
    }
}

impl<A, B, G, F> Unpin for Waiter<A, B, G, F> where A: Unpin, B: Unpin, G: FnMut(&Group) -> B {}

impl<A, B, G, F> Future for Waiter<A, B, G, F>
    where A: SignalVec<Item = Arc<Group>> + Unpin,
          B: SignalVec<Item = Arc<Tab>> + Unpin,
          G: FnMut(&Group) -> B,
          F: FnMut(bool, Option<SortTabs>) {

    type Output = ();

    fn poll(mut self: Pin<&mut Self>, waker: &LocalWaker) -> Poll<Self::Output> {
        let (changed, search, sort_tabs) = self.changed(waker);

        if changed {
            let this: &mut Self = &mut *self;
            (this.callback)(search, sort_tabs);
        }

        Poll::Pending
    }
}

pub(crate) fn waiter<F>(state: &State, f: F) -> impl Future<Output = ()> where F: FnMut(bool, Option<SortTabs>) {
    Waiter {
        signal: Some(state.groups.signal_vec_cloned()/*.delay_remove(|group| delay_animation(&group.insert_animation, &group.visible))*/),
        group_signal: |group| group.tabs.signal_vec_cloned()/*.delay_remove(|tab| delay_animation(&tab.insert_animation, &tab.visible))*/,
        groups: vec![],
        sort_tabs: Some(state.options.sort_tabs.signal()),
        callback: f,
    }
}


impl Tab {
	// TODO hacky
    fn height(&self) -> f64 {
        // TODO use range_inclusive ?
        let percentage = ease(self.insert_animation.current_percentage()).into_f64();

        (TAB_BORDER_WIDTH * percentage).round() +
        (TAB_PADDING * percentage).round() +
        (TAB_HEIGHT * percentage).round() +
        (TAB_PADDING * percentage).round() +
        (TAB_BORDER_WIDTH * percentage).round()
    }
}


impl Group {
	// TODO hacky
    // TODO what about when it's dragging ?
    fn height(&self) -> (f64, f64) {
        // TODO use range_inclusive
        let percentage = ease(self.insert_animation.current_percentage()).into_f64();

        (
            (GROUP_BORDER_WIDTH * percentage).round() +
            (GROUP_PADDING_TOP * percentage).round() +
            (if self.show_header { (GROUP_HEADER_HEIGHT * percentage).round() } else { 0.0 }),

            (GROUP_PADDING_BOTTOM * percentage).round()
        )
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

	// TODO debounce this ?
    // TODO make this simpler somehow ?
    // TODO add in stuff to handle dragging
    pub(crate) fn update(&self, should_search: bool, animate: bool) {
        // TODO add STATE.dragging.state to the waiter
        let dragging = self.dragging.state.lock_ref();
        let search_parser = self.search_parser.lock_ref();

        let top_y = self.scrolling.y.get().round();
        let bottom_y = top_y + (stdweb::web::window().inner_height() as f64 - TOOLBAR_TOTAL_HEIGHT);

        let mut padding: Option<f64> = None;
        let mut current_height: f64 = 0.0;

        self.groups.lock_mut().retain(|group| {
            // TODO remove it when the height is 0 ?
            if group.removing.get() && group.insert_animation.current_percentage() == Percentage::new(0.0) {
                false

            } else {
                let mut matches_search = false;

                let old_height = current_height;

                let mut tabs_padding: Option<f64> = None;

                let (top_height, bottom_height) = group.height();

                current_height += top_height;

                let tabs_height = current_height;

                // TODO what if there aren't any tabs in the group ?
                group.tabs.lock_mut().retain(|tab| {
                    // TODO remove it when the height is 0 ?
                    if tab.removing.get() && tab.insert_animation.current_percentage() == Percentage::new(0.0) {
                        false

                    } else {
                        // TODO what about if all the tabs are being dragged ?
                        if should_search && !tab.removing.get() {
                            if search_parser.matches_tab(tab) {
                                matches_search = true;
                                tab.matches_search.set_neq(true);

                                if animate {
                                    tab.insert_animation.animate_to(Percentage::new(1.0));

                                } else {
                                    tab.insert_animation.jump_to(Percentage::new(1.0));
                                }

                            } else {
                                tab.matches_search.set_neq(false);

                                if animate {
                                    tab.insert_animation.animate_to(Percentage::new(0.0));

                                } else {
                                    tab.insert_animation.jump_to(Percentage::new(0.0));
                                }
                            }
                        }

                        if !tab.dragging.get() {
                            let old_height = current_height;

                            current_height += tab.height();

                            if current_height > old_height && old_height < bottom_y && current_height > top_y {
                                if let None = tabs_padding {
                                    tabs_padding = Some(old_height);
                                }

                                tab.visible.set_neq(true);

                            } else {
                                self.hide_tab(&tab);
                            }

                        } else {
                            self.hide_tab(&tab);
                        }

                        true
                    }
                });

                if should_search {
                    if matches_search {
                        group.matches_search.set_neq(true);

                        if animate {
                            group.insert_animation.animate_to(Percentage::new(1.0));

                        } else {
                            group.insert_animation.jump_to(Percentage::new(1.0));
                        }

                    } else {
                        group.matches_search.set_neq(false);

                        if animate {
                            group.insert_animation.animate_to(Percentage::new(0.0));

                        } else {
                            group.insert_animation.jump_to(Percentage::new(0.0));
                        }
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

                    group.tabs_padding.set_neq(tabs_padding.unwrap_or(no_tabs_height) - tabs_height);
                    group.visible.set_neq(true);

                } else {
                    group.visible.set_neq(false);
                }

                true
            }
        });

        if let Some(DragState::Dragging { .. }) = *dragging {
            // TODO handle this better somehow ?
            current_height += DRAG_GAP_PX;
        }

        self.groups_padding.set_neq(padding.unwrap_or(0.0));
        self.scrolling.height.set_neq(current_height);
    }
}
