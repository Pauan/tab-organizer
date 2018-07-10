use {State, Group, Tab};
use std::sync::Arc;
use dominator::animation::{Percentage, MutableAnimation, MutableAnimationSignal};
use futures::{Future, FutureExt, Poll, Async, Never};
use futures::task::Context;
use futures_signals::signal::{Signal, SignalExt, Mutable, MutableSignal};
use futures_signals::signal_vec::{SignalVec, SignalVecExt, VecDiff};


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
    removing: Option<MutableSignal<bool>>,
    dragging: Option<MutableSignal<bool>>,
    drag_over: Option<MutableAnimationSignal>,
    insert_animation: Option<MutableAnimationSignal>,
}

impl TabState {
    fn new(tab: Arc<Tab>) -> Self {
        Self {
            removing: Some(tab.removing.signal()),
            dragging: Some(tab.dragging.signal()),
            drag_over: Some(tab.drag_over.signal()),
            insert_animation: Some(tab.insert_animation.signal()),
        }
    }

    fn changed(&mut self, cx: &mut Context) -> bool {
        let removing = changed(&mut self.removing, cx);
        let dragging = changed(&mut self.dragging, cx);
        let drag_over = changed(&mut self.drag_over, cx);
        let insert_animation = changed(&mut self.insert_animation, cx);
        removing || dragging || drag_over || insert_animation
    }
}


struct GroupState<A> {
    signal: Option<A>,
    tabs: Vec<TabState>,
    removing: Option<MutableSignal<bool>>,
    drag_top: Option<MutableAnimationSignal>,
    drag_over: Option<MutableAnimationSignal>,
    insert_animation: Option<MutableAnimationSignal>,
}

impl<A> GroupState<A> where A: SignalVec<Item = Arc<Tab>> {
    fn changed(&mut self, cx: &mut Context) -> (bool, bool) {
        let removing = changed(&mut self.removing, cx);
        let drag_top = changed(&mut self.drag_top, cx);
        let drag_over = changed(&mut self.drag_over, cx);
        let insert_animation = changed(&mut self.insert_animation, cx);
        let signal = changed_vec(&mut self.signal, cx, &mut self.tabs, TabState::new);

        let mut tabs = false;

        for mut tab in self.tabs.iter_mut() {
            if tab.changed(cx) {
                tabs = true;
            }
        }

        // TODO it should search only when a tab is inserted or updated, not removed
        (removing || drag_top || drag_over || insert_animation || signal || tabs, signal)
    }
}


struct Waiter<A, B, G, F> where G: FnMut(&Group) -> B {
    scroll_y: Option<MutableSignal<f64>>,
    signal: Option<A>,
    group_signal: G,
    groups: Vec<GroupState<B>>,
    callback: F,
}

impl<A, B, G, F> Waiter<A, B, G, F> where A: SignalVec<Item = Arc<Group>>, B: SignalVec<Item = Arc<Tab>>, G: FnMut(&Group) -> B, F: FnMut(bool) {
    fn changed(&mut self, cx: &mut Context) -> (bool, bool) {
        let scroll_y = changed(&mut self.scroll_y, cx);

        let group_signal = &mut self.group_signal;

        let signal = changed_vec(&mut self.signal, cx, &mut self.groups, |group| {
            GroupState {
                signal: Some(group_signal(&group)),
                tabs: vec![],
                removing: Some(group.removing.signal()),
                drag_top: Some(group.drag_top.signal()),
                drag_over: Some(group.drag_over.signal()),
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
        (scroll_y || signal || groups_changed, signal || groups_searched)
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
        scroll_y: Some(state.scroll_y.signal()),
        signal: Some(state.groups.signal_vec_cloned()/*.delay_remove(|group| delay_animation(&group.insert_animation, &group.visible))*/),
        group_signal: |group| group.tabs.signal_vec_cloned()/*.delay_remove(|tab| delay_animation(&tab.insert_animation, &tab.visible))*/,
        groups: vec![],
        callback: f,
    }
}
