import * as dom from "../dom";
import { uuid_port_tab } from "../../common/uuid";
import { ports } from "../../chrome/client";
import { async, async_callback } from "../../util/async";
import { Ref } from "../../util/mutable/ref";
import { Set } from "../../util/mutable/set";
import { Record } from "../../util/mutable/record";
import { List } from "../../util/mutable/list";
import { each, map, to_array, indexed } from "../../util/iterator";
import { assert, fail } from "../../util/assert";
import { init as init_top } from "./ui/top";
import { init as init_options } from "../sync/options";

import { make as make_sort_by_window } from "./logic/sort-by-window";
import { make as make_sort_by_created } from "./logic/sort-by-created";


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


export const windows    = new List();
export const window_ids = new Record();
export const tab_ids    = new Record();

const make_window = ({ "id": id,
                       "name": name }) =>
  new Record({
    "id": id,
    "name": new Ref(name),
    "tabs": new List(),
  });

const make_tab = ({ "id": id,
                    "url": url,
                    "time": time,
                    "title": title,
                    "favicon": favicon,
                    "pinned": pinned,
                    "focused": focused,
                    "unloaded": unloaded },
                  window) =>
  new Record({
    "id": id,
    "window": window,
    // TODO should this be a Ref instead ?
    "index": null,
    "time": new Record(time),
    //"groups": new Set(),

    "url": new Ref(url),
    "title": new Ref(title || url || ""),
    "favicon": new Ref(favicon),
    "pinned": new Ref(pinned),

    "selected": new Ref(false),
    "focused": new Ref(focused),
    "unloaded": new Ref(unloaded),

    // TODO this shouldn't be in here
    "matches": new Ref(false),
    "visible": new Ref(true),
    "animate": new Ref(false),
    "top": new Ref(null)
  });


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


  port.send({
    "type": "move-tabs",
    // TODO hacky
    "window": info.group.get("id"),
    "tabs": to_array(map(selected, (tab) => tab.get("id"))),
    "index": index2
  });
};


export const focus_tab = (tab) => {
  port.send({
    "type": "focus-tab",
    "tab-id": tab.get("id")
  });
};

export const close_tabs = (a) => {
  port.send({
    "type": "close-tabs",
    "tabs": to_array(map(a, (tab) => tab.get("id")))
  });
};


const update_windows = (a) => {
  each(indexed(a), ([i, x]) => {
    x.get("name").modify((name) => {
      if (name === null) {
        return "" + (i + 1);
      } else {
        return name;
      }
    });
  });
};

// TODO this can be more efficient if it is given the starting index
const update_tabs = (window) => {
  each(indexed(window.get("tabs")), ([i, x]) => {
    x.update("index", i);
  });
};


const port = ports.connect(uuid_port_tab);


export const init = async(function* () {
  yield async_callback((success, error) => {
    const types = {
      "init": ({ "windows": _windows }) => {

        each(_windows, (info) => {
          const window = make_window(info);

          const tabs = window.get("tabs");

          each(info["tabs"], (info) => {
            const tab = make_tab(info, window);

            tab_ids.insert(tab.get("id"), tab);

            tabs.push(tab);
          });

          // TODO because we're pushing, this can be made O(1) rather than O(n)
          update_tabs(window);

          window_ids.insert(window.get("id"), window);

          windows.push(window);
        });

        update_windows(windows);

        success(undefined);
      },

      "tab-open": ({ "tab": info,
                     "window-id": window_id,
                     "tab-index": index }) => {

        const window = window_ids.get(window_id);
        const tabs = window.get("tabs");

        const tab = make_tab(info, window);

        tab_ids.insert(tab.get("id"), tab);

        tabs.insert(index, tab);

        update_tabs(window);

        group_type.tab_open(tab, window, index);
      },

      // TODO update the timestamp as well
      "tab-focus": ({ "tab-id": id }) => {
        const tab = tab_ids.get(id);

        tab.get("focused").set(true);

        group_type.tab_focus(tab);
      },

      "tab-unfocus": ({ "tab-id": id }) => {
        const tab = tab_ids.get(id);

        tab.get("focused").set(false);

        group_type.tab_unfocus(tab);
      },

      "tab-update": ({ "tab-id": id,
                       "tab": { "url": url,
                                "title": title,
                                "favicon": favicon,
                                "pinned": pinned } }) => {

        const tab = tab_ids.get(id);

        tab.get("url").modify((old_url) => {
          // This is just to trigger a tab animation when the tab's URL changes
          if (old_url !== url) {
            const tabs = tab.get("window").get("tabs");
            const index = tab.get("index");

            assert(tabs.get(index) === tab);

            tabs.remove(index);
            tabs.insert(index, tab);
          }

          return url;
        });

        // TODO code duplication
        tab.get("title").set(title || url || "");
        tab.get("favicon").set(favicon);
        tab.get("pinned").set(pinned);

        group_type.tab_update(tab);
      },

      "tab-move": ({ "window-old-id": old_window_id,
                     "window-new-id": new_window_id,
                     "tab-old-index": old_index,
                     "tab-new-index": new_index,
                     "tab-id": tab_id }) => {

        const old_window = window_ids.get(old_window_id);
        const new_window = window_ids.get(new_window_id);
        const old_tabs = old_window.get("tabs");
        const new_tabs = new_window.get("tabs");
        const tab = tab_ids.get(tab_id);

        assert(old_tabs.get(old_index) === tab);

        old_tabs.remove(old_index);
        new_tabs.insert(new_index, tab);

        // TODO is this correct ?
        if (old_window === new_window) {
          update_tabs(old_window);

        } else {
          update_tabs(old_window);
          update_tabs(new_window);
        }

        // TODO need to pass in the index, etc.
        group_type.tab_move(tab);
      },

      "tab-close": ({ "window-id": window_id,
                      "tab-id": tab_id,
                      "tab-index": index }) => {

        const window = window_ids.get(window_id);
        const tab = tab_ids.get(tab_id);
        const tabs = window.get("tabs");

        tab_ids.remove(tab.get("id"));

        assert(tabs.get(index) === tab);

        tabs.remove(index);

        update_tabs(window);

        group_type.tab_close(tab, window, index);
      },

      "window-open": ({ "window": info,
                        "window-index": index }) => {

        const window = make_window(info);

        assert(info["tabs"]["length"] === 0);

        window_ids.insert(window.get("id"), window);

        windows.insert(index, window);

        // TODO this can be made more efficient
        update_windows(windows);

        group_type.window_open(window, index);
      },

      "window-close": ({ "window-id": window_id,
                         "window-index": index }) => {

        const window = window_ids.get(window_id);

        assert(window.get("tabs").size === 0);

        window_ids.remove(window.get("id"));

        assert(windows.get(index) === window);

        windows.remove(index);

        update_windows(windows);

        group_type.window_close(window, index);
      }
    };

    port.on_receive((x) => {
      const type = x["type"];
      if (types[type]) {
        types[type](x);
      } else {
        fail();
      }
    });
  });


  const { get: opt } = yield init_options;
  const { top: ui_top } = yield init_top;


  // TODO a little bit hacky
  let group_type = null;

  opt("group.sort.type").each((type) => {
    if (type === "window") {
      group_type = make_sort_by_window();

    } else if (type === "created") {
      group_type = make_sort_by_created();

    } else {
      fail();
    }
  });


  group_type.init(windows);

  dom.main(ui_top(group_type.groups));
});
