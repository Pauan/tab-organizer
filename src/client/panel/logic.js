import { async } from "../../util/async";
import { Ref } from "../../util/ref";
import { each, indexed, first, reverse } from "../../util/iterator";
import { assert, fail } from "../../util/assert";
import { init as init_tabs } from "../sync/tabs";
import { init as init_options } from "../sync/options";
import { init as init_sort_by_window } from "./sort/window";
import { init as init_sort_by_created } from "./sort/created";
import { init as init_sort_by_focused } from "./sort/focused";
import { init as init_sort_by_title } from "./sort/title";
import { init as init_sort_by_url } from "./sort/url";


export const init = async([init_tabs,
                           init_options,
                           init_sort_by_window,
                           init_sort_by_created,
                           init_sort_by_focused,
                           init_sort_by_title,
                           init_sort_by_url],
                          (tabs,
                           { get: opt },
                           { make: make_sort_by_window },
                           { make: make_sort_by_created },
                           { make: make_sort_by_focused },
                           { make: make_sort_by_title },
                           { make: make_sort_by_url }) => {

  /*const get_groups = new Ref((tab) => {
    const title = tab.get("title").value;
    return [title ? title[0] : ""];
  });*/

  /*const sort_tab = new Ref((tab1, tab2) => {
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
    switch (opt("tabs.click.type").get()) {
    case "select-focus":
      if (tab.get("selected").get()) {
        focus_tab(tab);

      } else {
        deselect_group(group);
        select_tab(group, tab);
      }
      break;

    case "focus":
      if (!tab.get("selected").get()) {
        deselect_group(group);
      }

      focus_tab(tab);
      break;

    default:
      fail();
    }
  };


  const deselect_group = (group) => {
    group.update("first-selected-tab", null);

    each(group.get("tabs"), (tab) => {
      tab.get("selected").set(false);
    });
  };

  const select_tab = (group, tab) => {
    assert(group.get("first-selected-tab") === null);
    assert(tab.get("selected").get() === false);

    group.update("first-selected-tab", tab);

    tab.get("selected").set(true);
  };

  const ctrl_select_tab = (group, tab) => {
    tab.get("selected").modify((selected) => {
      if (selected) {
        group.update("first-selected-tab", null);
        return false;

      } else {
        group.update("first-selected-tab", tab);
        return true;
      }
    });
  };

  const shift_select_tab = (group, tab) => {
    const selected_tab = group.get("first-selected-tab");

    if (selected_tab === null) {
      group.update("first-selected-tab", tab);

      tab.get("selected").set(true);


    } else if (tab === selected_tab) {
      each(group.get("tabs"), (x) => {
        x.get("selected").set(x === tab);
      });


    // TODO put in assertions to verify that this is correct
    } else {
      let seen = 0;

      each(group.get("tabs"), (x) => {
        if (x === tab || x === selected_tab) {
          x.get("selected").set(true);
          ++seen;

        } else if (seen === 1) {
          x.get("selected").set(true);

        } else {
          x.get("selected").set(false);
        }
      });
    }
  };


  let drag_info = null;

  const get_direction_swap = (direction) =>
    (direction === "up"
      ? "down"
      : "up");

  const get_direction_group = (group) => {
    // TODO is there a better way than using indexes ?
    const old_index = drag_info.group.get("index");
    const new_index = group.get("index");

    assert(old_index !== null);
    assert(new_index !== null);

    return (old_index < new_index ? "down" : "up");
  };

  const get_direction_tab = (tab) => {
    // TODO is there a better way than using indexes ?
    const old_index = drag_info.tab.get("index");
    const new_index = tab.get("index");

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
    const tabs = group.get("tabs");

    const m = first(tabs, (tab) => tab.get("visible").get());

    if (m.has()) {
      return m.get();
    } else {
      // TODO is it guaranteed that the group has tabs in it ?
      return tabs.get(0);
    }
  };

  const find_last = (group) => {
    const tabs = group.get("tabs");

    // TODO inefficient
    const m = first(reverse(tabs), (tab) => tab.get("visible").get());

    if (m.has()) {
      return m.get();
    } else {
      // TODO is it guaranteed that the group has tabs in it ?
      return tabs.get(-1);
    }
  };

  // TODO test this
  const update_dragging = (group) => {
    let top   = 0;
    let empty = true;

    each(group.get("tabs"), (x) => {
      // TODO a bit hacky
      if (drag_info.tab === x && drag_info.direction === "up") {
        top += drag_info.height;
      }

      // TODO a little bit hacky
      if (x.get("visible").get()) {
        x.get("animate").set(drag_info.animate);
        x.get("top").set(top + "px");

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

    group.get("height").set(top + "px");
  };

  const stop_dragging = (group) => {
    each(group.get("tabs"), (x) => {
      x.get("animate").set(false);
      x.get("top").set(null);
    });

    group.get("height").set(null);
  };

  const drag_onto_tab = (new_group, new_tab) => {
    if (drag_info !== null) {
      const old_group = drag_info.group;

      drag_info.direction = get_direction(new_group, new_tab);
      drag_info.animate   = (old_group === new_group);
      drag_info.group     = new_group;
      drag_info.tab       = new_tab;

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
        drag_info.animate   = false;
        drag_info.group     = new_group;
        drag_info.tab       = new_tab;

        update_dragging(old_group);
        update_dragging(new_group);
      }
    }
  };

  const drag_start = ({ group, tab, height }) => {
    drag_info = {
      animate: false,
      group: group,
      tab: tab,
      height: height,
      direction: "up"
    };

    // TODO hacky
    each(group_type.get().groups, (group) => {
      update_dragging(group);
    });
  };

  // TODO what about "first-selected-tab" ?
  const drag_end = (selected) => {
    const info = drag_info;

    drag_info = null;

    // TODO hacky
    each(group_type.get().groups, (group) => {
      stop_dragging(group);
    });


    const index1 = info.tab.get("index");

    assert(index1 !== null);

    const index2 = (info.direction === "down"
                     ? index1 + 1
                     : index1);

    /*const tabs = info.group.get("tabs");

    each(indexed(selected), ([i, x]) => {
      // TODO hacky
      const old_window = x.get("window");
      const old_index = x.get("index");
      const old_tabs = old_window.get("tabs");

      // TODO hacky
      x.update("window", info.group);

      old_tabs.remove(old_index);

      if (old_tabs === tabs && old_index < index2) {
        tabs.insert(index2 - 1, x);
      } else {
        tabs.insert(index2 + i, x);
      }

      // TODO inefficient
      update_tabs(old_tabs, false);
    });

    update_tabs(tabs, false);*/


    /*port.send({
      "type": "move-tabs",
      // TODO hacky
      "window": info.group.get("id"),
      "tabs": to_array(map(selected, (tab) => tab.get("id"))),
      "index": index2
    });*/
  };


  const focus_tab = tabs.focus_tab;

  const close_tabs = tabs.close_tabs;


  // TODO a little bit hacky
  const group_type = new Ref(null);

  // TODO handle stop somehow ?
  opt("group.sort.type").each((type) => {
    const x = group_type.get();

    // TODO test this
    if (x !== null) {
      x.stop();
    }

    if (type === "window") {
      group_type.set(make_sort_by_window());

    } else if (type === "created") {
      group_type.set(make_sort_by_created());

    } else if (type === "focused") {
      group_type.set(make_sort_by_focused());

    } else if (type === "title") {
      group_type.set(make_sort_by_title());

    } else if (type === "url") {
      group_type.set(make_sort_by_url());

    } else {
      fail();
    }
  });


  return { group_type, close_tabs, click_tab, drag_start, drag_end,
           focus_tab, shift_select_tab, ctrl_select_tab,
           drag_onto_tab, drag_onto_group };
});
