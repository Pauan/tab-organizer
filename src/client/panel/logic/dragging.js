import * as list from "../../../util/list";
import * as record from "../../../util/record";
import * as stream from "../../../util/stream";
import * as async from "../../../util/async";
import * as maybe from "../../../util/maybe";
import * as mutable from "../../../util/mutable";
import { assert } from "../../../util/assert";
import { init as init_groups } from "./groups";


export const init = async.all([init_groups],
                              ({ groups, move_tabs }) => {

  let drag_info = null;

  const dragging_animate    = mutable.make(false);
  const dragging_started    = mutable.make(null);
  const dragging_dimensions = mutable.make(null);

  const get_direction_swap = (direction) =>
    (direction === "up"
      ? "down"
      : "up");

  const get_direction_group = (group) => {
    // TODO is there a better way than using indexes ?
    const old_index = record.get(drag_info.group, "index");
    const new_index = record.get(group, "index");

    assert(old_index !== null);
    assert(new_index !== null);

    return (old_index < new_index ? "down" : "up");
  };

  const get_direction_tab = (tab) => {
    // TODO is there a better way than using indexes ?
    const old_index = record.get(drag_info.tab, "index");
    const new_index = record.get(tab, "index");

    assert(old_index !== null);
    assert(new_index !== null);

    return (old_index < new_index ? "down" : "up");
  };

  const get_direction = (group, tab) => {
    if (drag_info.tab === tab) {
      return get_direction_swap(drag_info.direction);

    } else if (drag_info.group === group) {
      return get_direction_tab(tab);

    } else {
      return get_direction_group(group);
    }
  };

  const find_first = (group) => {
    const tabs = stream.current(record.get(group, "tabs"));

    const m = list.find_first(tabs, (tab) =>
                mutable.get(record.get(tab, "visible")));

    if (maybe.has(m)) {
      return maybe.get(m);

    } else {
      // TODO is it guaranteed that the group has tabs in it ?
      return list.get(tabs, 0);
    }
  };

  const find_last = (group) => {
    const tabs = stream.current(record.get(group, "tabs"));

    const m = list.find_last(tabs, (tab) =>
                mutable.get(record.get(tab, "visible")));

    if (maybe.has(m)) {
      return maybe.get(m);

    } else {
      // TODO is it guaranteed that the group has tabs in it ?
      return list.get(tabs, -1);
    }
  };

  // TODO test this
  const update_dragging = (group) => {
    let top   = 0;
    let empty = true;

    const tabs = stream.current(record.get(group, "tabs"));

    list.each(tabs, (x) => {
      // TODO a bit hacky
      if (drag_info.tab === x && drag_info.direction === "up") {
        top += drag_info.height;
      }

      // TODO a little bit hacky
      if (mutable.get(record.get(x, "visible"))) {
        mutable.set(record.get(x, "top"), top + "px");

        top += 20; // TODO gross
        empty = false;
      }

      // TODO a bit hacky
      if (drag_info.tab === x && drag_info.direction === "down") {
        top += drag_info.height;
      }
    });

    if (empty) {
      top += 20; // TODO gross
    }

    mutable.set(record.get(group, "height"), top + "px");
  };

  const stop_dragging = (group) => {
    const tabs = stream.current(record.get(group, "tabs"));

    list.each(tabs, (x) => {
      mutable.set(record.get(x, "top"), null);
    });

    mutable.set(record.get(group, "height"), null);
  };

  const drag_onto_tab = (new_group, new_tab) => {
    if (drag_info !== null) {
      const old_group = drag_info.group;

      drag_info.direction = get_direction(new_group, new_tab);
      drag_info.group     = new_group;
      drag_info.tab       = new_tab;

      mutable.set(dragging_animate, (old_group === new_group));

      if (old_group === new_group) {
        update_dragging(old_group);

      } else {
        update_dragging(old_group);
        update_dragging(new_group);
      }
    }
  };

  const drag_onto_group = (new_group) => {
    if (drag_info !== null) {
      const old_group = drag_info.group;

      // TODO this isn't quite right, but it works most of the time
      if (old_group !== new_group) {
        const direction = get_direction_group(new_group);

        const new_tab = (direction === "up"
                          ? find_last(new_group)
                          : find_first(new_group));

        drag_info.direction = get_direction_swap(direction);
        drag_info.group     = new_group;
        drag_info.tab       = new_tab;

        mutable.set(dragging_animate, false);

        update_dragging(old_group);
        update_dragging(new_group);
      }
    }
  };

  const drag_start = ({ group, tab, height }) => {
    drag_info = {
      group: group,
      tab: tab,
      height: height,
      direction: "up"
    };

    assert(mutable.get(dragging_animate) === false);

    // TODO hacky ?
    list.each(stream.current(mutable.get(groups)), (group) => {
      update_dragging(group);
    });
  };

  // TODO what about "first-selected-tab" ?
  const drag_end = (selected) => {
    const info = drag_info;

    drag_info = null;

    mutable.set(dragging_animate, false);

    // TODO hacky ?
    list.each(stream.current(mutable.get(groups)), (group) => {
      stop_dragging(group);
    });


    const index1 = record.get(info.tab, "index");

    assert(index1 !== null);

    const index2 = (info.direction === "down"
                     ? index1 + 1
                     : index1);

    /*const tabs = record.get(info.group, "tabs");

    list.each(selected, (x, i) => {
      // TODO hacky
      const old_window = record.get(x, "window");
      const old_index = record.get(x, "index");
      const old_tabs = record.get(old_window, "tabs");

      // TODO hacky
      record.update(x, "window", info.group);

      stream.remove(old_tabs, old_index);

      if (old_tabs === tabs && old_index < index2) {
        stream.insert(tabs, index2 - 1, x);
      } else {
        stream.insert(tabs, index2 + i, x);
      }

      // TODO inefficient
      update_tabs(old_tabs, false);
    });

    update_tabs(tabs, false);*/

    move_tabs(info.group, selected, index2);
  };


  return async.done({ drag_start, drag_end, drag_onto_tab,
                      drag_onto_group, dragging_animate,
                      dragging_started, dragging_dimensions });
});
