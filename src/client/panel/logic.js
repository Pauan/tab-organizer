import { uuid_port_tab } from "../../common/uuid";
import { init as init_chrome } from "../../chrome/client";
import { async } from "../../util/async";
import { Ref } from "../../util/mutable/ref";
import { Set } from "../../util/mutable/set";
import { Record } from "../../util/mutable/record";
import { List, SortedList } from "../../util/mutable/list";
import { each } from "../../util/iterator";
import { assert, fail } from "../../util/assert";

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


/*const sort_group = (x, y) =>
  y.get("time") - x.get("time");

const sort_tab = (x, y) =>
  y.get("time").get("created") -
  x.get("time").get("created");*/


const windows    = new List();
const window_ids = new Record();
const tab_ids    = new Record();

/*const group_ids  = new Record();
const group_list = new SortedList(sort_group);*/

/*
// TODO move this to another module
const pluralize = (x, s) => {
  if (x === 1) {
    return x + s;
  } else {
    return x + s + "s";
  }
};

const diff_to_text = (diff) => {
  if (diff.day === 0) {
    if (diff.hour === 0) {
      return "Less than an hour ago";
    } else {
      return pluralize(diff.hour, " hour") + " ago";
    }
  } else {
    // TODO is this correct ?
    const hours = diff.hour - (diff.day * 24);
    return pluralize(diff.day, " day") + " " + pluralize(hours, " hour") + " ago";
  }
};

const get_group_name = (time) =>
  diff_to_text(difference(round_to_hour(current_time()), time));


const get_groups = (tab) => {
  const time = round_to_hour(tab.get("time").get("created"));
  const id = "" + time;

  if (group_ids.has(id)) {
    return [group_ids.get(id)];

  } else {
    const group = new Record({
      "id": id,
      "name": new Ref(get_group_name(time)),
      "time": time,
      "tabs": new SortedList(sort_tab),
      "selected": new SortedList(sort_tab)
    });

    group_ids.insert(id, group);

    group_list.insert(group);

    return [group];
  }
};*/

const make_window = (info) => {
  return new Record({
    "id": info.get("id"),
    "name": new Ref(info.get("name")),
    "tabs": new List()
  });
};

const make_tab = (info, focused, unloaded) => {
  return new Record({
    "id": info.get("id"),
    //"time": info.get("time"),
    //"groups": new Set(),

    "url": new Ref(info.get("url")),
    "title": new Ref(info.get("title") || info.get("url") || ""),
    "favicon": new Ref(info.get("favicon")),
    "pinned": new Ref(info.get("pinned")),

    "selected": new Ref(false),
    "focused": new Ref(focused),
    "unloaded": new Ref(unloaded)
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


dom.main(ui_group_list(windows));


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

          const tab = make_tab(info, _transient.has(tab_id) &&
                                     _transient.get(tab_id).get("focused"),
                                     !_transient.has(tab_id));

          tab_ids.insert(tab.get("id"), tab);

          tabs.push(tab);
        });

        window_ids.insert(window.get("id"), window);

        windows.push(window);
      });
    },

    "tab-open": (x) => {
      const transient = x.get("transient");
      const info = x.get("tab");
      const window = window_ids.get(x.get("window-id"));
      const index = x.get("tab-index");

      const tab = make_tab(info, transient.get("focused"), false);

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
