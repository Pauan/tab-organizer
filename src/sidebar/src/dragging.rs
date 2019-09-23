use crate::constants::TAB_DRAGGING_THRESHOLD;
use std::sync::Arc;
use crate::types::{State, DragState, Group, Tab};
use tab_organizer::state::SortTabs;
use web_sys::DomRect;
use futures_signals::signal::Signal;
use dominator::animation::Percentage;


impl Group {
    fn tabs_each<F>(&self, mut f: F) where F: FnMut(&Tab) {
        let slice = self.tabs.lock_ref();

        for tab in slice.iter() {
            f(&tab);
        }
    }

    fn update_dragging_tabs<F>(&self, tab_index: Option<usize>, mut f: F) where F: FnMut(&Tab, Percentage) {
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
}


impl State {
	fn find_group_index(groups: &[Arc<Group>], group_id: usize) -> usize {
        groups.iter().position(|x| x.id == group_id).unwrap_or_else(|| groups.len())
    }

    fn change_groups(&self, old_group: &Group, new_group: &Group) {
        old_group.drag_over.animate_to(Percentage::new(0.0));
        new_group.drag_over.animate_to(Percentage::new(1.0));

        self.update_dragging_groups(new_group.id, |group, percentage| {
            group.drag_top.animate_to(percentage);
        });

        old_group.tabs_each(|tab| {
            tab.drag_over.animate_to(Percentage::new(0.0));
        });
    }

    fn update_dragging_groups<F>(&self, group_id: usize, mut f: F) where F: FnMut(&Group, Percentage) {
        let groups = self.groups.lock_ref();

        let mut seen = false;

        for x in groups.iter() {
            let percentage = if x.id == group_id {
                seen = true;
                Percentage::new(0.0)

            } else if seen {
                Percentage::new(1.0)

            } else {
                Percentage::new(0.0)
            };

            f(&x, percentage);
        }
    }

    fn get_dragging_index(&self, group_id: usize) -> Option<usize> {
        let dragging = self.dragging.state.lock_ref();

        if let Some(DragState::Dragging { ref group, tab_index, .. }) = *dragging {
            if group.id == group_id {
                Some(tab_index.unwrap_or_else(|| group.tabs.lock_ref().len()))

            } else {
                None
            }

        } else {
            None
        }
    }

    fn drag_tabs_to(&self, group: &Group, tabs: &[Arc<Tab>]) {
        let _tabs = tabs.into_iter().filter(|x| !x.removed.get());
    }

	pub(crate) fn should_be_dragging_group(&self, new_index: usize) -> bool {
        let dragging = self.dragging.state.lock_ref();

        if let Some(DragState::Dragging { ref group, .. }) = *dragging {
            let groups = self.groups.lock_ref();

            let old_index = Self::find_group_index(&groups, group.id);

            new_index > old_index

        } else {
            false
        }
    }

    pub(crate) fn drag_over(&self, new_group: Arc<Group>, new_index: usize) {
        let groups = self.groups.lock_ref();

        // TODO is this correct ?
        // TODO pass in the new_group_index as a function argument
        if let Some(new_group_index) = groups.iter().position(|x| x.id == new_group.id) {
            let mut dragging = self.dragging.state.lock_mut();

            // TODO verify that this doesn't notify if it isn't dragging
            if let Some(DragState::Dragging { ref mut group, ref mut tab_index, .. }) = *dragging {
                let len = new_group.tabs.lock_ref().len();

                let new_tab_index = if new_group.id == group.id {
                    // TODO code duplication with get_dragging_index
                    let old_index = tab_index.unwrap_or(len);

                    if old_index <= new_index {
                        let new_index = new_index + 1;

                        if new_index < len {
                            Some(new_index)

                        } else {
                            None
                        }

                    } else {
                        Some(new_index)
                    }

                } else {
                    self.change_groups(&group, &new_group);

                    let old_group_index = Self::find_group_index(&groups, group.id);

                    if new_index == (len - 1) {
                        None

                    } else if old_group_index <= new_group_index {
                        let new_index = new_index + 1;

                        if new_index < len {
                            Some(new_index)

                        } else {
                            None
                        }

                    } else {
                        Some(new_index)
                    }
                };

                new_group.update_dragging_tabs(new_tab_index, |tab, percentage| {
                    tab.drag_over.animate_to(percentage);
                });

                *group = new_group;
                *tab_index = new_tab_index;
            }
        }
    }

    pub(crate) fn drag_over_group(&self, new_group: Arc<Group>, new_group_index: usize) {
        let mut dragging = self.dragging.state.lock_mut();

        // TODO verify that this doesn't notify if it isn't dragging
        if let Some(DragState::Dragging { ref mut group, ref mut tab_index, .. }) = *dragging {
            let new_tab_index = if new_group.id == group.id {
                // TODO it shouldn't notify dragging
                return;

            } else {
                self.change_groups(&group, &new_group);

                let groups = self.groups.lock_ref();

                let old_group_index = Self::find_group_index(&groups, group.id);

                if old_group_index < new_group_index {
                    Some(0)

                } else {
                    None
                }
            };

            new_group.update_dragging_tabs(new_tab_index, |tab, percentage| {
                tab.drag_over.animate_to(percentage);
            });

            *group = new_group;
            *tab_index = new_tab_index;
        }
    }

    pub(crate) fn should_be_dragging_tab(&self, group_id: usize, new_index: usize) -> bool {
        self.get_dragging_index(group_id).map(|old_index| new_index > old_index).unwrap_or(false)
    }

    pub(crate) fn drag_start(&self, mouse_x: i32, mouse_y: i32, rect: DomRect, group: Arc<Group>, tab: Arc<Tab>, tab_index: usize) {
        let mut dragging = self.dragging.state.lock_mut();

        if dragging.is_none() && self.can_start_drag() {
            *dragging = Some(DragState::DragStart { mouse_x, mouse_y, rect, group, tab, tab_index });
        }
    }

    pub(crate) fn drag_move(&self, new_x: i32, new_y: i32) {
        let mut dragging = self.dragging.state.lock_mut();

        let new_dragging = match *dragging {
            Some(DragState::DragStart { mouse_x, mouse_y, ref rect, ref group, ref tab, tab_index }) => {
                let mouse_x = (mouse_x - new_x) as f64;
                let mouse_y = (mouse_y - new_y) as f64;

                if mouse_x.hypot(mouse_y) > TAB_DRAGGING_THRESHOLD {
                    let tab_index = Some(tab_index);

                    let selected_tabs: Vec<Arc<Tab>> = if tab.selected.get() {
                        group.tabs.lock_ref().iter()
                            .filter(|x| x.selected.get() && x.matches_search.get())
                            .cloned()
                            .collect()

                    } else {
                        vec![tab.clone()]
                    };

                    if selected_tabs.len() != 0 {
                        group.drag_over.jump_to(Percentage::new(1.0));

                        self.update_dragging_groups(group.id, |group, percentage| {
                            group.drag_top.jump_to(percentage);
                        });

                        group.update_dragging_tabs(tab_index, |tab, percentage| {
                            tab.drag_over.jump_to(percentage);
                        });

                        for tab in selected_tabs.iter() {
                            tab.dragging.set_neq(true);
                        }

                        self.dragging.selected_tabs.set(selected_tabs);

                        self.start_scrolling(new_y);

                        Some(DragState::Dragging { mouse_x: new_x, mouse_y: new_y, rect: rect.clone(), group: group.clone(), tab_index })

                    } else {
                        None
                    }

                } else {
                    None
                }
            },

            Some(DragState::Dragging { .. }) => {
                // TODO hacky
                match *dragging {
                    Some(DragState::Dragging { ref mut mouse_x, ref mut mouse_y, .. }) => {
                        self.start_scrolling(new_y);
                        *mouse_x = new_x;
                        *mouse_y = new_y;
                        None
                    },
                    _ => {
                        unreachable!();
                    },
                }
            },

            None => None,
        };

        if new_dragging.is_some() {
            *dragging = new_dragging;
        }
    }

    pub(crate) fn drag_end(&self) {
        let mut dragging = self.dragging.state.lock_mut();
        let mut selected_tabs = self.dragging.selected_tabs.lock_mut();

        if let Some(DragState::Dragging { ref group, .. }) = *dragging {
            self.stop_scrolling();

            group.drag_over.jump_to(Percentage::new(0.0));

            group.tabs_each(|tab| {
                tab.drag_over.jump_to(Percentage::new(0.0));
            });

            {
                let groups = self.groups.lock_ref();

                for group in groups.iter() {
                    group.drag_top.jump_to(Percentage::new(0.0));
                }
            }

            self.drag_tabs_to(&group, &**selected_tabs);
        }

        if dragging.is_some() {
            *dragging = None;
        }

        if selected_tabs.len() != 0 {
            for tab in selected_tabs.iter() {
                tab.dragging.set_neq(false);
            }

            *selected_tabs = vec![];
        }
    }

    pub(crate) fn can_start_drag(&self) -> bool {
        let sort_tabs = self.options.sort_tabs.lock_ref();

        *sort_tabs == SortTabs::Window ||
        *sort_tabs == SortTabs::Tag
    }

    pub(crate) fn is_dragging(&self) -> impl Signal<Item = bool> {
        self.dragging.state.signal_ref(|dragging| {
            if let Some(DragState::Dragging { .. }) = dragging {
                true

            } else {
                false
            }
        })
    }
}
