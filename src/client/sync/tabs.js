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
const tags       = record.make();
const window_ids = record.make();
const tab_ids    = record.make();
const events     = event.make();

const make_tag = (info) =>
  record.make({
    "id": record.get(info, "id"),
    "tabs": list.map(record.get(info, "tabs"), (id) =>
              record.get(tab_ids, id))
  });

const make_window = (info, tabs) =>
  record.make({
    "id": record.get(info, "id"),
    "name": record.get(info, "name"),
    "tabs": tabs,
  });

const make_tab = (info, transient) => {
  const url   = record.get(info, "url");
  const title = record.get(info, "title");

  return record.make({
    "id": record.get(info, "id"),
    "time": record.get(info, "time"),

    "url": url,
    // TODO maybe this should be server-side ?
    "title": title || url,
    "favicon": record.get(info, "favicon"),
    "pinned": record.get(info, "pinned"),

    "focused": (transient !== null && record.get(transient, "focused")),
    "unloaded": (transient === null),
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
    const _windows = record.get(info, "current.windows");
    const _window_ids = record.get(info, "current.window-ids");
    const _tab_ids = record.get(info, "current.tab-ids");
    const _transient_tab_ids = record.get(info, "transient.tab-ids");
    const _tag_ids = record.get(info, "current.tag-ids");

    list.each(_windows, (id) => {
      const info = record.get(_window_ids, id);

      const tabs = record.get(info, "tabs");

      const window = make_window(info, list.map(tabs, (id) => {
        const info = record.get(_tab_ids, id);

        const transient = (record.has(_transient_tab_ids, id)
                            ? record.get(_transient_tab_ids, id)
                            : null);

        const tab = make_tab(info, transient);

        record.insert(tab_ids, record.get(tab, "id"), tab);

        return tab;
      }));

      record.insert(window_ids, record.get(window, "id"), window);

      list.push(windows, window);
    });

    record.each(_tag_ids, (id, info) => {
      const tag = make_tag(info);

      record.insert(tags, record.get(tag, "id"), tag);
    });

    timer.done(duration);
    console["debug"]("tabs: initialized (" + timer.diff(duration) + "ms)");

    async.success(init, { windows, tags, events, focus_tab, close_tabs });
  },

  "tab-open": (json) => {
    const info      = record.get(json, "tab");
    const window_id = record.get(json, "window-id");
    const index     = record.get(json, "tab-index");
    const transient = record.get(json, "tab-transient");

    const window = record.get(window_ids, window_id);
    const tabs   = record.get(window, "tabs");

    const tab = make_tab(info, transient);

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
    const url = record.get(json, "tab-url");
    const title = record.get(json, "tab-title");
    const favicon = record.get(json, "tab-favicon");
    const pinned = record.get(json, "tab-pinned");
    const time = record.get(json, "tab-time-updated");

    const tab = record.get(tab_ids, id);

    // TODO code duplication
    record.update(tab, "url", url);
    // TODO maybe this should be server-side ?
    record.update(tab, "title", title || url);
    record.update(tab, "favicon", favicon);
    record.update(tab, "pinned", pinned);
    record.assign(record.get(tab, "time"), "updated", time);

    event.send(events, {
      type: "tab-update",
      tab
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

    assert(list.size(record.get(info, "tabs")) === 0);

    const window = make_window(info, list.make());

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
  },

  "tag-create": (json) => {
    const info = record.get(json, "tag");

    const tag = make_tag(info);

    record.insert(tags, record.get(tag, "id"), tag);

    event.send(events, {
      type: "tag-create",
      tag
    });
  },

  "tag-insert-tab": (json) => {
    const tag_id = record.get(json, "tag-id");
    const tab_id = record.get(json, "tab-id");

    const tab = record.get(tab_ids, tab_id);
    const tag = record.get(tags, tag_id);
    const tabs = record.get(tag, "tabs");

    list.push(tabs, tab);

    event.send(events, {
      type: "tag-insert-tab",
      tag,
      tab
    });
  },

  "tag-remove-tab": (json) => {
    const tab_id = record.get(json, "tab-id");
    const tag_id = record.get(json, "tag-id");
    const index = record.get(json, "tab-index");

    const tab = record.get(tab_ids, tab_id);
    const tag = record.get(tags, tag_id);
    const tabs = record.get(tag, "tabs");

    assert(list.get(index) === tab);
    list.remove(tabs, index);

    assert(list.size(tabs) > 0);

    event.send(events, {
      type: "tag-remove-tab",
      tag,
      tab,
      index
    });
  },

  "tag-remove": (json) => {
    const tag_id = record.get(json, "tag-id");

    const tag = record.get(tags, tag_id);

    record.remove(tags, tag_id);

    event.send(events, {
      type: "tag-remove",
      tag
    });
  }
});

ports.on_receive(port, (x) => {
  record.get(types, record.get(x, "type"))(x);
});
