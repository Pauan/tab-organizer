import * as list from "../../util/list";
import * as async from "../../util/async";
import * as event from "../../util/event";
import * as record from "../../util/record";
import * as timer from "../../util/timer";
import { uuid_port_tab } from "../../common/uuid";
import { ports } from "../../chrome/client";
import { assert } from "../../util/assert";


const duration = timer.make();

export const init = async.make();

const port       = ports.open(uuid_port_tab);
const windows    = list.make();
const window_ids = record.make();
const tab_ids    = record.make();
const events     = event.make();

const make_window = (info) =>
  record.make({
    "id": record.get(info, "id"),
    "name": record.get(info, "name"),
    "tabs": list.make(),
  });

const make_tab = (info, window) => {
  const url   = record.get(info, "url");
  const title = record.get(info, "title");

  return record.make({
    "id": record.get(info, "id"),
    "window": window,
    "time": record.make(record.get(info, "time")),

    "url": url,
    "title": title || url || "",
    "favicon": record.get(info, "favicon"),
    "pinned": record.get(info, "pinned"),

    "focused": record.get(info, "focused"),
    "unloaded": record.get(info, "unloaded"),
  });
};


const close_tabs = (a) => {
  ports.send(port, record.make({
    "type": "close-tabs",
    "tabs": list.map(a, (tab) => record.get(tab, "id"))
  }));
};

const focus_tab = (tab) => {
  ports.send(port, record.make({
    "type": "focus-tab",
    "tab-id": record.get(tab, "id")
  }));
};


const types = record.make({
  "init": (info) => {
    const _windows = record.get(info, "windows");

    list.each(_windows, (info) => {
      const window = make_window(info);

      const tabs = record.get(window, "tabs");

      list.each(record.get(info, "tabs"), (info) => {
        const tab = make_tab(info, window);

        record.insert(tab_ids, record.get(tab, "id"), tab);

        list.push(tabs, tab);
      });

      record.insert(window_ids, record.get(window, "id"), window);

      list.push(windows, window);
    });

    timer.done(duration);
    console["debug"]("tabs: initialized (" + timer.diff(duration) + "ms)");

    async.success(init, { windows, events, focus_tab, close_tabs });
  },

  "tab-open": (json) => {
    const info      = record.get(json, "tab");
    const window_id = record.get(json, "window-id");
    const index     = record.get(json, "tab-index");

    const window = record.get(window_ids, window_id);
    const tabs   = record.get(window, "tabs");

    const tab = make_tab(info, window);

    record.insert(tab_ids, record.get(tab, "id"), tab);

    list.insert(tabs, index, tab);

    event.send(events, {
      type: "tab-open",
      window,
      tab,
      index
    });
  },

  "tab-focus": (json) => {
    const id = record.get(json, "tab-id");
    const time_focused = record.get(json, "tab-time-focused");

    const tab = record.get(tab_ids, id);

    record.update(tab, "focused", true);
    // TODO test this
    record.assign(record.get(tab, "time"), "focused", time_focused);

    event.send(events, {
      type: "tab-focus",
      tab
    });
  },

  "tab-unfocus": (json) => {
    const id = record.get(json, "tab-id");

    const tab = record.get(tab_ids, id);

    record.update(tab, "focused", false);

    event.send(events, {
      type: "tab-unfocus",
      tab
    });
  },

  "tab-update": (json) => {
    const id = record.get(json, "tab-id");
    const info = record.get(json, "tab");

    const url = record.get(info, "url");
    const title = record.get(info, "title");
    const favicon = record.get(info, "favicon");
    const pinned = record.get(info, "pinned");
    const time = record.get(info, "time");

    const tab = record.get(tab_ids, id);

    const old = record.make({
      "url": record.get(tab, "url"),
      "title": record.get(tab, "title"),
      "favicon": record.get(tab, "favicon"),
      "pinned": record.get(tab, "pinned"),
      "time": record.get(tab, "time")
    });

    // TODO code duplication
    record.update(tab, "url", url);
    record.update(tab, "title", title || url || "");
    record.update(tab, "favicon", favicon);
    record.update(tab, "pinned", pinned);
    record.update(tab, "time", record.make(time));

    event.send(events, {
      type: "tab-update",
      tab,
      old
    });
  },

  "tab-move": (json) => {
    const old_window_id = record.get(json, "window-old-id");
    const new_window_id = record.get(json, "window-new-id");
    const old_index = record.get(json, "tab-old-index");
    const new_index = record.get(json, "tab-new-index");
    const tab_id = record.get(json, "tab-id");
    const time_moved = record.get(json, "tab-time-moved");

    const old_window = record.get(window_ids, old_window_id);
    const new_window = record.get(window_ids, new_window_id);
    const old_tabs = record.get(old_window, "tabs");
    const new_tabs = record.get(new_window, "tabs");
    const tab = record.get(tab_ids, tab_id);

    assert(record.get(tab, "window") === old_window);
    record.update(tab, "window", new_window);
    // TODO test this
    record.assign(record.get(tab, "time"), "moved", time_moved);

    assert(list.get(old_tabs, old_index) === tab);

    list.remove(old_tabs, old_index);
    list.insert(new_tabs, new_index, tab);

    event.send(events, {
      type: "tab-move",
      tab,
      old_window,
      new_window,
      old_index,
      new_index
    });
  },

  "tab-close": (json) => {
    const window_id = record.get(json, "window-id");
    const tab_id = record.get(json, "tab-id");
    const index = record.get(json, "tab-index");

    const window = record.get(window_ids, window_id);
    const tab = record.get(tab_ids, tab_id);
    const tabs = record.get(window, "tabs");

    record.update(tab, "window", null);

    record.remove(tab_ids, record.get(tab, "id"));

    assert(list.get(tabs, index) === tab);

    list.remove(tabs, index);

    event.send(events, {
      type: "tab-close",
      window,
      tab,
      index
    });
  },

  "window-open": (json) => {
    const info = record.get(json, "window");
    const index = record.get(json, "window-index");

    const window = make_window(info);

    assert(list.size(record.get(info, "tabs")) === 0);

    record.insert(window_ids, record.get(window, "id"), window);

    list.insert(windows, index, window);

    event.send(events, {
      type: "window-open",
      window,
      index
    });
  },

  "window-close": (json) => {
    const window_id = record.get(json, "window-id");
    const index = record.get(json, "window-index");

    const window = record.get(window_ids, window_id);

    assert(list.size(record.get(window, "tabs")) === 0);

    record.remove(window_ids, record.get(window, "id"));

    assert(list.get(windows, index) === window);

    list.remove(windows, index);

    event.send(events, {
      type: "window-close",
      window,
      index
    });
  }
});

ports.on_receive(port, (x) => {
  record.get(types, record.get(x, "type"))(x);
});
