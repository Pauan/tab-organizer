use tab_organizer::ease;
use constants::{DRAG_GAP_PX, TOOLBAR_TOTAL_HEIGHT, GROUP_BORDER_WIDTH, GROUP_PADDING_TOP, GROUP_HEADER_HEIGHT, GROUP_PADDING_BOTTOM, TAB_PADDING, TAB_HEIGHT, TAB_BORDER_WIDTH};
use types::{State, DragState, Group, Tab};
use std::sync::Arc;
use stdweb;
use dominator::animation::{Percentage, MutableAnimationSignal};
use futures::{Future, Poll, Async, Never};
use futures::task::Context;
use futures_signals::signal::{Signal, MutableSignal, MutableSignalCloned};
use futures_signals::signal_vec::{SignalVec, VecDiff};


/*pub(crate) fn delay_animation(animation: &MutableAnimation, visible: &Mutable<bool>) -> impl Future<Item = (), Error = Never> {
    animation.signal().wait_for(Percentage::new(0.0)).select(visible.signal().wait_for(false))
        // TODO a bit gross
        .map(|_| ())
        .map_err(|_| unreachable!())
}*/


fn changed_vec<A, B, C, F>(signal: &mut Option<C>, cx: &mut Context, vec: &mut Vec<B>, mut f: F) -> bool where C: SignalVec<Item = A>, F: FnMut(A) -> B {
    let mut changed = false;

    loop {
        match signal.as_mut().map(|signal| signal.poll_vec_change(cx)) {
            Some(Async::Ready(Some(change))) => {
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
            Some(Async::Ready(None)) => {
                *signal = None;
            },
            Some(Async::Pending) => {},
            None => {},
        }

        return changed;
    }
}

fn changed<A, B>(signal: &mut Option<B>, cx: &mut Context) -> bool where B: Signal<Item = A> {
    let mut changed = false;

    loop {
        match signal.as_mut().map(|signal| signal.poll_change(cx)) {
            Some(Async::Ready(Some(_))) => {
                changed = true;
                continue;
            },
            Some(Async::Ready(None)) => {
                *signal = None;
            },
            Some(Async::Pending) => {},
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

    fn changed(&mut self, cx: &mut Context) -> (bool, bool) {
        let url = changed(&mut self.url, cx);
        let title = changed(&mut self.title, cx);
        let removing = changed(&mut self.removing, cx);
        let dragging = changed(&mut self.dragging, cx);
        let insert_animation = changed(&mut self.insert_animation, cx);
        (url || title || removing || dragging || insert_animation, url || title)
    }
}


struct GroupState<A> {
    signal: Option<A>,
    tabs: Vec<TabState>,
    removing: Option<MutableSignal<bool>>,
    insert_animation: Option<MutableAnimationSignal>,
}

impl<A> GroupState<A> where A: SignalVec<Item = Arc<Tab>> {
    fn changed(&mut self, cx: &mut Context) -> (bool, bool) {
        let removing = changed(&mut self.removing, cx);
        let insert_animation = changed(&mut self.insert_animation, cx);
        let signal = changed_vec(&mut self.signal, cx, &mut self.tabs, TabState::new);

        let mut tabs = false;
        let mut search = false;

        for mut tab in self.tabs.iter_mut() {
            let x = tab.changed(cx);

            if x.0 {
                tabs = true;
            }

            if x.1 {
                search = true;
            }
        }

        // TODO it should search only when a tab is inserted or updated, not removed
        (removing || insert_animation || signal || tabs, signal || search)
    }
}


struct Waiter<A, B, G, F> where G: FnMut(&Group) -> B {
    signal: Option<A>,
    group_signal: G,
    groups: Vec<GroupState<B>>,
    callback: F,
}

impl<A, B, G, F> Waiter<A, B, G, F> where A: SignalVec<Item = Arc<Group>>, B: SignalVec<Item = Arc<Tab>>, G: FnMut(&Group) -> B, F: FnMut(bool) {
    fn changed(&mut self, cx: &mut Context) -> (bool, bool) {
        let group_signal = &mut self.group_signal;

        let signal = changed_vec(&mut self.signal, cx, &mut self.groups, |group| {
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
            let (x, y) = group.changed(cx);

            if x {
                groups_changed = true;
            }

            if y {
                groups_searched = true;
            }
        }

        // TODO it should search only when a group is inserted or updated, not removed
        (signal || groups_changed, signal || groups_searched)
    }
}

impl<A, B, G, F> Future for Waiter<A, B, G, F> where A: SignalVec<Item = Arc<Group>>, B: SignalVec<Item = Arc<Tab>>, G: FnMut(&Group) -> B, F: FnMut(bool) {
    type Item = ();
    type Error = Never;

    fn poll(&mut self, cx: &mut Context) -> Poll<Self::Item, Self::Error> {
        let (changed, search) = self.changed(cx);

        if changed {
            (self.callback)(search);
        }

        Ok(Async::Pending)
    }
}

pub(crate) fn waiter<F>(state: &State, f: F) -> impl Future<Item = (), Error = Never> where F: FnMut(bool) {
    Waiter {
        signal: Some(state.groups.signal_vec_cloned()/*.delay_remove(|group| delay_animation(&group.insert_animation, &group.visible))*/),
        group_signal: |group| group.tabs.signal_vec_cloned()/*.delay_remove(|tab| delay_animation(&tab.insert_animation, &tab.visible))*/,
        groups: vec![],
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
    pub(crate) fn update(&self, should_search: bool) {
        // TODO add STATE.dragging.state to the waiter
        let dragging = self.dragging.state.lock_ref();
        let search_parser = self.search_parser.lock_ref();

        let top_y = self.scrolling.y.get().round();
        let bottom_y = top_y + (stdweb::web::window().inner_height() as f64 - TOOLBAR_TOTAL_HEIGHT);

        let mut padding: Option<f64> = None;
        let mut current_height: f64 = 0.0;

        self.groups.lock_mut().retain(|group| {
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
                    if tab.removing.get() && tab.insert_animation.current_percentage() == Percentage::new(0.0) {
                        false

                    } else {
                        if should_search {
                            if search_parser.matches_tab(tab) {
                                tab.matches_search.set_neq(true);

                            } else {
                                tab.matches_search.set_neq(false);
                            }
                        }

                        // TODO what about if all the tabs are being dragged ?
                        if tab.matches_search.get() {
                            matches_search = true;

                            if !tab.dragging.get() {
                                let old_height = current_height;

                                current_height += tab.height();

                                if old_height < bottom_y && current_height > top_y {
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

                        } else {
                            self.hide_tab(&tab);
                        }

                        true
                    }
                });

                if should_search {
                    if matches_search {
                        group.matches_search.set_neq(true);

                    } else {
                        group.matches_search.set_neq(false);
                    }
                }

                if matches_search {
                    let no_tabs_height = current_height;

                    current_height += bottom_height;

                    if old_height < bottom_y && current_height > top_y {
                        if let None = padding {
                            padding = Some(old_height);
                        }

                        group.tabs_padding.set_neq(tabs_padding.unwrap_or(no_tabs_height) - tabs_height);
                        group.visible.set_neq(true);

                    } else {
                        group.visible.set_neq(false);
                    }

                } else {
                    current_height = old_height;
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
