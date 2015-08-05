import * as dom from "../dom";
import { async } from "../../util/async";
import { Ref } from "../../util/mutable/ref";
import { each, map, to_array, indexed } from "../../util/iterator";
import { assert, fail } from "../../util/assert";
import { init as init_top } from "./ui/top";
import { init as init_options } from "../sync/options";
import { init as init_sort_by_window } from "./logic/sort-by-window";
import { init as init_sort_by_created } from "./logic/sort-by-created";
import { init as init_sort_by_focused } from "./logic/sort-by-focused";
import { init as init_sort_by_title } from "./logic/sort-by-title";


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


export const deselect_tab = (group, tab) => {
  if (!tab.get("selected").get()) {
    group.update("first-selected-tab", null);

    each(group.get("tabs"), (tab) => {
      tab.get("selected").set(false);
    });
  }
};

export const ctrl_select_tab = (group, tab) => {
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

export const shift_select_tab = (group, tab) => {
  const selected_tab = group.get("first-selected-tab");

  if (selected_tab === null) {
    group.update("first-selected-tab", tab);

    tab.get("selected").set(true);


  } else if (tab === selected_tab) {
    each(group.get("tabs"), (x) => {
      x.get("selected").set(x === tab);
    });


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


const drag_info = new Ref(null);

const get_direction = (info, group, tab) => {
  if (info.tab === tab) {
    return (info.direction === "up"
             ? "down"
             : "up");

  } else if (info.group === group) {
    // TODO is there a better way than using indexes ?
    const old_index = info.tab.get("index");
    const new_index = tab.get("index");

    if (old_index < new_index) {
      return "down";

    } else {
      return "up";
    }

  } else {
    return info.direction;
  }
};

// TODO test this
const update_dragging = (group) => {
  const a = group.get("tabs");

  const info = drag_info.get();

  let top = 0;

  each(a, (x) => {
    // TODO a bit hacky
    if (info !== null && info.tab === x && info.direction === "up") {
      top += info.height;
    }

    // TODO a little bit hacky
    if (x.get("visible").get()) {
      x.get("animate").set(info !== null && info.animate);
      x.get("top").set(info !== null ? top + "px" : null);

      top += 20; // TODO gross
    }

    // TODO a bit hacky
    if (info !== null && info.tab === x && info.direction === "down") {
      top += info.height;
    }
  });

  group.get("height").set(info !== null ? top + "px" : null);
};

export const drag_onto_tab = (group, tab) => {
  const info = drag_info.get();

  if (info) {
    drag_info.set({
      animate: info.group === group,
      group: group,
      tab: tab,
      height: info.height,
      direction: get_direction(info, group, tab)
    });

    if (info.group === group) {
      update_dragging(group);

    } else {
      update_dragging(group);
      update_dragging(info.group);
    }
  }
};

export const drag_onto_group = (group) => {
  const info = drag_info.get();

  // TODO this isn't quite right, but it works most of the time
  if (info !== null && info.group !== group) {
    // TODO is this guaranteed to be correct ?
    assert(group.get("tabs").size > 0);

    drag_info.set({
      animate: info.group === group,
      group: group,
      tab: group.get("tabs").get(-1),
      height: info.height,
      direction: "down"
    });

    if (info.group === group) {
      update_dragging(group);

    } else {
      update_dragging(group);
      update_dragging(info.group);
    }
  }
};

export const drag_start = ({ group, tab, height }) => {
  drag_info.set({
    animate: false,
    group: group,
    tab: tab,
    height: height,
    direction: "up"
  });

  update_dragging(group);
};

// TODO what about "first-selected-tab" ?
export const drag_end = (selected) => {
  const info = drag_info.get();

  drag_info.set(null);

  update_dragging(info.group);


  const index1 = info.tab.get("index");
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


export const focus_tab = (tab) => {
  /*port.send({
    "type": "focus-tab",
    "tab-id": tab.get("id")
  });*/
};

export const close_tabs = (a) => {
  /*port.send({
    "type": "close-tabs",
    "tabs": to_array(map(a, (tab) => tab.get("id")))
  });*/
};


export const init = async(function* () {
  const { get: opt } = yield init_options;
  const { top: ui_top } = yield init_top;
  const { make: make_sort_by_window } = yield init_sort_by_window;
  const { make: make_sort_by_created } = yield init_sort_by_created;
  const { make: make_sort_by_focused } = yield init_sort_by_focused;
  const { make: make_sort_by_title } = yield init_sort_by_title;


  // TODO a little bit hacky
  let group_type = null;

  opt("group.sort.type").each((type) => {
    if (group_type !== null) {
      group_type.stop();
    }

    if (type === "window") {
      group_type = make_sort_by_window();

    } else if (type === "created") {
      group_type = make_sort_by_created();

    } else if (type === "focused") {
      group_type = make_sort_by_focused();

    } else if (type === "title") {
      group_type = make_sort_by_title();

    } else {
      fail();
    }
  });


  dom.main(ui_top(group_type.groups));
});
