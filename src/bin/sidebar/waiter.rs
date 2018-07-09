use {State, Group, Tab};
use std::sync::Arc;
use dominator::animation::{MutableAnimationSignal};
use futures::{Future, Poll, Async, Never};
use futures::task::Context;
use futures_signals::signal::{Signal, MutableSignal};
use futures_signals::signal_vec::{SignalVec, VecDiff, MutableSignalVec};


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
    dragging: Option<MutableSignal<bool>>,
    drag_over: Option<MutableAnimationSignal>,
    insert_animation: Option<MutableAnimationSignal>,
}

impl TabState {
    fn new(tab: Arc<Tab>) -> Self {
        Self {
            dragging: Some(tab.dragging.signal()),
            drag_over: Some(tab.drag_over.signal()),
            insert_animation: Some(tab.insert_animation.signal()),
        }
    }

    fn changed(&mut self, cx: &mut Context) -> bool {
        let a = changed(&mut self.dragging, cx);
        let b = changed(&mut self.drag_over, cx);
        let c = changed(&mut self.insert_animation, cx);
        a || b || c
    }
}


struct GroupState {
    signal: Option<MutableSignalVec<Arc<Tab>>>,
    tabs: Vec<TabState>,
    drag_top: Option<MutableAnimationSignal>,
    drag_over: Option<MutableAnimationSignal>,
    insert_animation: Option<MutableAnimationSignal>,
}

impl GroupState {
    fn new(group: Arc<Group>) -> Self {
        Self {
            signal: Some(group.tabs.signal_vec_cloned()),
            tabs: vec![],
            drag_top: Some(group.drag_top.signal()),
            drag_over: Some(group.drag_over.signal()),
            insert_animation: Some(group.insert_animation.signal()),
        }
    }

    fn changed(&mut self, cx: &mut Context) -> (bool, bool) {
        let a = changed(&mut self.drag_top, cx);
        let b = changed(&mut self.drag_over, cx);
        let c = changed(&mut self.insert_animation, cx);
        let d = changed_vec(&mut self.signal, cx, &mut self.tabs, TabState::new);

        let mut e = false;

        for mut tab in self.tabs.iter_mut() {
            if tab.changed(cx) {
                e = true;
            }
        }

        (a || b || c || d || e, d)
    }
}


struct Waiter<F> {
    scroll_y: Option<MutableSignal<f64>>,
    signal: Option<MutableSignalVec<Arc<Group>>>,
    groups: Vec<GroupState>,
    callback: F,
}

impl<F> Waiter<F> where F: FnMut(bool) {
    fn changed(&mut self, cx: &mut Context) -> (bool, bool) {
        let a = changed(&mut self.scroll_y, cx);
        let b = changed_vec(&mut self.signal, cx, &mut self.groups, GroupState::new);

        let mut c = false;
        let mut d = false;

        for mut group in self.groups.iter_mut() {
            let (x, y) = group.changed(cx);

            if x {
                c = true;
            }

            if y {
                d = true;
            }
        }

        (a || b || c, b || d)
    }
}

impl<F> Future for Waiter<F> where F: FnMut(bool) {
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
        signal: Some(state.groups.signal_vec_cloned()),
        groups: vec![],
        callback: f,
    }
}
