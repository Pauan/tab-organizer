import { uuid_port_tab } from "../../common/uuid";
import { init as init_chrome } from "../../chrome/client";
import { async } from "../../util/async";
import { Ref } from "../../util/mutable/ref";
import { Set } from "../../util/mutable/set";
import { Record } from "../../util/mutable/record";
import { List, SortedList } from "../../util/mutable/list";
import { each } from "../../util/iterator";
import { assert, fail } from "../../util/assert";

import * as sort_by_window from "./logic/sort-by-window";

import { current_time, round_to_hour, difference } from "../../util/time";
import { group_list as ui_group_list } from "./ui/group-list";
import * as dom from "../dom";


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

const make_window = (info) => {
  return new Record({
    "id": info.get("id"),
    "name": new Ref(info.get("name")),
    "tabs": new List(),
    // TODO a little hacky
    "first-selected-tab": null
  });
};

const make_tab = (info, window, focused, unloaded) => {
  return new Record({
    "id": info.get("id"),
    "window": window,
    // TODO make this into a Record or Ref ?
    "time": info.get("time"),
    //"groups": new Set(),

    "url": new Ref(info.get("url")),
    "title": new Ref(info.get("title") || info.get("url") || ""),
    "favicon": new Ref(info.get("favicon")),
    "pinned": new Ref(info.get("pinned")),

    "selected": new Ref(false),
    "focused": new Ref(focused),
    "unloaded": new Ref(unloaded),
    // TODO a little hacky ?
    "visible": new Ref(true)
  });

  /*each(get_groups(tab), (group) => {
    tab.get("groups").insert(group);
    group.get("tabs").insert(tab);
  });*/
};

/*
// TODO remove remaining tabs as well ?
// TODO what about "selected" ?
const remove_group = (group) => {
  group_ids.remove(group.get("id"));

  group_list.remove(group);
};*/

/*const remove_tab = (tab) => {
  const groups = tab.get("groups");

  each(groups, (group) => {
    const tabs = group.get("tabs");

    tabs.remove(tab);

    if (tabs.size === 0) {
      remove_group(group);
    }
  });

  groups.clear();
};*/

export const move_tabs = (selected, { group, tab, direction }) => {
  each(selected, (tab) => {
    const tabs = tab.get("window").get("tabs");
    // TODO hacky
    tab.update("window", group);
    // TODO inefficient
    tabs.remove(tabs.index_of(tab).get());
  });

  const tabs = group.get("tabs");

  const index = (direction === "down"
                  // TODO inefficient
                  ? tabs.index_of(tab).get() + 1
                  : tabs.index_of(tab).get());

  each(selected, (tab) => {
    tabs.insert(index, tab);
  });
};


dom.main(ui_group_list(sort_by_window.groups));


export const init = async(function* () {
  const { ports } = yield init_chrome;

  const port = ports.connect(uuid_port_tab);

  const types = {
    "init": (x) => {
      const _windows = x.get("current.windows");
      const _window_ids = x.get("current.window-ids");
      const _tab_ids = x.get("current.tab-ids");
      const _transient = x.get("transient.tab-ids");

      each(_windows, (window_id) => {
        const info = _window_ids.get(window_id);

        const window = make_window(info);

        const tabs = window.get("tabs");

        each(info.get("tabs"), (tab_id) => {
          const info = _tab_ids.get(tab_id);

          const tab = make_tab(info, window,
                               _transient.has(tab_id) &&
                               _transient.get(tab_id).get("focused"),
                               !_transient.has(tab_id));

          tab_ids.insert(tab.get("id"), tab);

          tabs.push(tab);
        });

        window_ids.insert(window.get("id"), window);

        windows.push(window);
      });

      //sort_by_window.init(windows);
    },

    "tab-open": (x) => {
      const transient = x.get("transient");
      const info = x.get("tab");
      const window = window_ids.get(x.get("window-id"));
      const index = x.get("tab-index");

      const tab = make_tab(info, window, transient.get("focused"), false);

      tab_ids.insert(tab.get("id"), tab);

      window.get("tabs").insert(index, tab);
    },

    // TODO update the timestamp as well
    "tab-focus": (x) => {
      tab_ids.get(x.get("tab-id")).get("focused").set(true);
    },

    "tab-unfocus": (x) => {
      tab_ids.get(x.get("tab-id")).get("focused").set(false);
    },

    "tab-update": (x) => {
      const tab = tab_ids.get(x.get("tab-id"));
      const info = x.get("tab");

      tab.get("url").set(info.get("url"));
      // TODO code duplication
      tab.get("title").set(info.get("title") || info.get("url") || "");
      tab.get("favicon").set(info.get("favicon"));
      tab.get("pinned").set(info.get("pinned"));
    },

    "tab-move": (x) => {
      const old_window = window_ids.get(x.get("window-old-id"));
      const new_window = window_ids.get(x.get("window-new-id"));
      const old_index = x.get("tab-old-index");
      const new_index = x.get("tab-new-index");
      const tab = tab_ids.get(x.get("tab-id"));

      assert(old_window.get("tabs").get(old_index) === tab);

      old_window.get("tabs").remove(old_index);
      new_window.get("tabs").insert(new_index, tab);
    },

    "tab-close": (x) => {
      const window = window_ids.get(x.get("window-id"));
      const tab = tab_ids.get(x.get("tab-id"));
      const index = x.get("tab-index");

      tab_ids.remove(tab.get("id"));

      assert(window.get("tabs").get(index) === tab);

      window.get("tabs").remove(index);
    },

    "window-open": (x) => {
      const info = x.get("window");
      const window = make_window(info);
      const index = x.get("window-index");

      assert(info.get("tabs").size === 0);

      window_ids.insert(window.get("id"), window);

      windows.insert(index, window);
    },

    "window-close": (x) => {
      const window = window_ids.get(x.get("window-id"));
      const index = x.get("window-index");

      assert(window.get("tabs").size === 0);

      window_ids.remove(window.get("id"));

      assert(windows.get(index) === window);

      windows.remove(index);
    }
  };

  port.on_receive((x) => {
    const type = x.get("type");
    if (types[type]) {
      types[type](x);
    } else {
      fail();
    }
  });
});
