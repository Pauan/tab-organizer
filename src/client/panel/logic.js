import * as list from "../../util/list";
import * as record from "../../util/record";
import * as stream from "../../util/stream";
import * as async from "../../util/async";
import * as maybe from "../../util/maybe";
import * as ref from "../../util/ref";
import { assert, fail } from "../../util/assert";
import { init as init_tabs } from "../sync/tabs";
import { init as init_options } from "../sync/options";
import { init as init_sort_by_window } from "./sort/window";
//import { init as init_sort_by_tag } from "./sort/tag";
import { init as init_sort_by_created } from "./sort/created";
import { init as init_sort_by_focused } from "./sort/focused";
import { init as init_sort_by_title } from "./sort/title";
import { init as init_sort_by_url } from "./sort/url";


export const init = async.all([init_tabs,
                               init_options,
                               init_sort_by_window,
                               //init_sort_by_tag,
                               init_sort_by_created,
                               init_sort_by_focused,
                               init_sort_by_title,
                               init_sort_by_url],
                              (tabs,
                               { get: opt },
                               { make: make_sort_by_window },
                               //{ make: make_sort_by_tag },
                               { make: make_sort_by_created },
                               { make: make_sort_by_focused },
                               { make: make_sort_by_title },
                               { make: make_sort_by_url }) => {

  /*const get_groups = ref.make((tab) => {
    const title = tab.get("title").value;
    return [title ? title[0] : ""];
  });*/

  /*const sort_tab = ref.make((tab1, tab2) => {
    const title1 = tab1.get("title").value;
    const title2 = tab2.get("title").value;

    if (title1 === title2) {
      return tab1.get("time").get("created") -
             tab2.get("time").get("created");

    } else if (title1 < title2) {
      return -1;
    } else {
      return 1;
    }
  });*/


  const click_tab = (group, tab) => {
    // TODO ew
    switch (ref.get(opt("tabs.click.type"))) {
    case "select-focus":
      if (ref.get(record.get(tab, "selected"))) {
        focus_tab(tab);

      } else {
        deselect_group(group);
        select_tab(group, tab);
      }
      break;

    case "focus":
      if (!ref.get(record.get(tab, "selected"))) {
        deselect_group(group);
      }

      focus_tab(tab);
      break;

    default:
      fail();
    }
  };


  const deselect_group = (group) => {
    record.update(group, "first-selected-tab", null);

    list.each(stream.current(record.get(group, "tabs")), (tab) => {
      ref.set(record.get(tab, "selected"), false);
    });
  };

  const select_tab = (group, tab) => {
    assert(record.get(group, "first-selected-tab") === null);
    assert(ref.get(record.get(tab, "selected")) === false);

    record.update(group, "first-selected-tab", tab);

    ref.set(record.get(tab, "selected"), true);
  };

  const ctrl_select_tab = (group, tab) => {
    ref.modify(record.get(tab, "selected"), (selected) => {
      if (selected) {
        record.update(group, "first-selected-tab", null);
        return false;

      } else {
        record.update(group, "first-selected-tab", tab);
        return true;
      }
    });
  };

  const shift_select_tab = (group, tab) => {
    const selected_tab = record.get(group, "first-selected-tab");

    if (selected_tab === null) {
      record.update(group, "first-selected-tab", tab);

      ref.set(record.get(tab, "selected"), true);


    } else if (tab === selected_tab) {
      list.each(stream.current(record.get(group, "tabs")), (x) => {
        ref.set(record.get(x, "selected"), x === tab);
      });


    // TODO put in assertions to verify that this is correct
    } else {
      let seen = 0;

      list.each(stream.current(record.get(group, "tabs")), (x) => {
        if (x === tab || x === selected_tab) {
          ref.set(record.get(x, "selected"), true);
          ++seen;

        } else if (seen === 1) {
          ref.set(record.get(x, "selected"), true);

        } else {
          ref.set(record.get(x, "selected"), false);
        }
      });
    }
  };


  let drag_info = null;

  const dragging_animate = ref.make(false);

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
    const tabs = record.get(group, "tabs");

    const m = list.find_first(stream.current(tabs), (tab) =>
                ref.get(record.get(tab, "visible")));

    if (maybe.has(m)) {
      return maybe.get(m);
    } else {
      // TODO is it guaranteed that the group has tabs in it ?
      return list.get(stream.current(tabs), 0);
    }
  };

  const find_last = (group) => {
    const tabs = record.get(group, "tabs");

    const m = list.find_last(stream.current(tabs), (tab) =>
                ref.get(record.get(tab, "visible")));

    if (maybe.has(m)) {
      return maybe.get(m);
    } else {
      // TODO is it guaranteed that the group has tabs in it ?
      return list.get(stream.current(tabs), -1);
    }
  };

  // TODO test this
  const update_dragging = (group) => {
    let top   = 0;
    let empty = true;

    list.each(stream.current(record.get(group, "tabs")), (x) => {
      // TODO a bit hacky
      if (drag_info.tab === x && drag_info.direction === "up") {
        top += drag_info.height;
      }

      // TODO a little bit hacky
      if (ref.get(record.get(x, "visible"))) {
        ref.set(record.get(x, "top"), top + "px");

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

    ref.set(record.get(group, "height"), top + "px");
  };

  const stop_dragging = (group) => {
    list.each(stream.current(record.get(group, "tabs")), (x) => {
      ref.set(record.get(x, "top"), null);
    });

    ref.set(record.get(group, "height"), null);
  };

  const drag_onto_tab = (new_group, new_tab) => {
    if (drag_info !== null) {
      const old_group = drag_info.group;

      drag_info.direction = get_direction(new_group, new_tab);
      drag_info.group     = new_group;
      drag_info.tab       = new_tab;

      ref.set(dragging_animate, (old_group === new_group));

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

        ref.set(dragging_animate, false);

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

    assert(ref.get(dragging_animate) === false);

    // TODO hacky
    list.each(stream.current(ref.get(group_type).groups), (group) => {
      update_dragging(group);
    });
  };

  // TODO what about "first-selected-tab" ?
  const drag_end = (selected) => {
    const info = drag_info;

    drag_info = null;

    ref.set(dragging_animate, false);

    // TODO hacky
    list.each(stream.current(ref.get(group_type).groups), (group) => {
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


    /*ports.send(port, record.make({
      "type": "move-tabs",
      // TODO hacky
      "window": record.get(info.group, "id"),
      "tabs": list.map(selected, (tab) => record.get(tab, "id")),
      "index": index2
    }));*/
  };


  const focus_tab = tabs.focus_tab;

  const close_tabs = tabs.close_tabs;


  // TODO a little bit hacky
  const group_type = ref.make(null);

  // TODO handle stop somehow ?
  ref.listen(opt("group.sort.type"), (type) => {
    const x = ref.get(group_type);

    // TODO test this
    if (x !== null) {
      x.stop();
    }

    if (type === "window") {
      ref.set(group_type, make_sort_by_window());

    } else if (type === "tag") {
      //ref.set(group_type, make_sort_by_tag());

    } else if (type === "created") {
      ref.set(group_type, make_sort_by_created());

    } else if (type === "focused") {
      ref.set(group_type, make_sort_by_focused());

    } else if (type === "title") {
      ref.set(group_type, make_sort_by_title());

    } else if (type === "url") {
      ref.set(group_type, make_sort_by_url());

    } else {
      fail();
    }
  });


  return async.done({ group_type, close_tabs, click_tab, drag_start, drag_end,
                      focus_tab, shift_select_tab, ctrl_select_tab,
                      drag_onto_tab, drag_onto_group, dragging_animate });
});
