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

const port   = ports.open(uuid_port_tab);
const events = event.make();

let windows;
let window_ids;
let tab_ids;
let transient_ids;
let tag_ids;


const close_tabs = (a) => {
  ports.send(port, record.make({
    "type": "close-tabs",
    "tabs": a
  }));
};

const focus_tab = (tab_id) => {
  ports.send(port, record.make({
    "type": "focus-tab",
    "tab-id": tab_id
  }));
};


const update_time = (tab, name, time) => {
  // TODO test this
  record.assign(record.get(tab, "time"), name, time);
};


const types = record.make({
  "init": (json) => {
    windows       = record.get(json, "current.windows");
    window_ids    = record.get(json, "current.window-ids");
    tab_ids       = record.get(json, "current.tab-ids");
    transient_ids = record.get(json, "transient.tab-ids");
    tag_ids       = record.get(json, "current.tag-ids");

    timer.done(duration);
    console["info"]("tabs: initialized (" + timer.diff(duration) + "ms)");

    async.success(init, { windows, window_ids, tab_ids, transient_ids,
                          tag_ids, events, focus_tab, close_tabs });
  },

  "tab-open": (json) => {
    const tab       = record.get(json, "tab");
    const window_id = record.get(json, "window-id");
    const index     = record.get(json, "tab-index");
    const transient = record.get(json, "tab-transient");

    const tab_id = record.get(tab, "id");
    const window = record.get(window_ids, window_id);
    const tabs   = record.get(window, "tabs");

    record.insert(tab_ids, tab_id, tab);
    record.insert(transient_ids, tab_id, transient);

    list.insert(tabs, index, tab_id);

    event.send(events, json);
  },

  "tab-focus": (json) => {
    const tab_id = record.get(json, "tab-id");
    const time   = record.get(json, "tab-time-focused");

    const transient = record.get(transient_ids, tab_id);
    const tab       = record.get(tab_ids, tab_id);

    record.modify(transient, "focused", (focused) => {
      assert(focused === false);
      return true;
    });

    update_time(tab, "focused", time);

    event.send(events, json);
  },

  "tab-unfocus": (json) => {
    const tab_id = record.get(json, "tab-id");

    const transient = record.get(transient_ids, tab_id);

    record.modify(transient, "focused", (focused) => {
      assert(focused === true);
      return false;
    });

    event.send(events, json);
  },

  "tab-update": (json) => {
    const tab_id  = record.get(json, "tab-id");
    const url     = record.get(json, "tab-url");
    const title   = record.get(json, "tab-title");
    const favicon = record.get(json, "tab-favicon");
    const pinned  = record.get(json, "tab-pinned");
    const time    = record.get(json, "tab-time-updated");

    const tab = record.get(tab_ids, tab_id);

    record.update(tab, "url", url);
    record.update(tab, "title", title);
    record.update(tab, "favicon", favicon);
    record.update(tab, "pinned", pinned);

    update_time(tab, "updated", time);

    event.send(events, json);
  },

  "tab-move": (json) => {
    const old_window_id = record.get(json, "window-old-id");
    const new_window_id = record.get(json, "window-new-id");
    const old_index     = record.get(json, "tab-old-index");
    const new_index     = record.get(json, "tab-new-index");
    const tab_id        = record.get(json, "tab-id");
    const time_moved    = record.get(json, "tab-time-moved");

    const old_window = record.get(window_ids, old_window_id);
    const new_window = record.get(window_ids, new_window_id);
    const old_tabs = record.get(old_window, "tabs");
    const new_tabs = record.get(new_window, "tabs");
    const tab = record.get(tab_ids, tab_id);

    record.modify(tab, "window", (window_id) => {
      assert(window_id === old_window_id);
      return new_window_id;
    });

    update_time(tab, "moved", time_moved);

    assert(list.get(old_tabs, old_index) === tab_id);

    list.remove(old_tabs, old_index);
    list.insert(new_tabs, new_index, tab_id);

    event.send(events, json);
  },

  "tab-close": (json) => {
    const window_id = record.get(json, "window-id");
    const tab_id    = record.get(json, "tab-id");
    const index     = record.get(json, "tab-index");

    const window = record.get(window_ids, window_id);
    const tab    = record.get(tab_ids, tab_id);
    const tabs   = record.get(window, "tabs");

    assert(record.get(tab, "window") === window_id);

    record.remove(tab_ids, tab_id);
    record.remove(transient_ids, tab_id);

    assert(list.get(tabs, index) === tab_id);

    list.remove(tabs, index);

    // TODO is this correct ?
    assert(list.size(tabs) > 0);

    event.send(events, json);
  },

  "window-open": (json) => {
    const window = record.get(json, "window");
    const index  = record.get(json, "window-index");

    const window_id = record.get(window, "id");

    assert(list.size(record.get(window, "tabs")) === 0);

    record.insert(window_ids, window_id, window);

    list.insert(windows, index, window_id);

    event.send(events, json);
  },

  "window-close": (json) => {
    const window_id = record.get(json, "window-id");
    const index     = record.get(json, "window-index");

    const window = record.get(window_ids, window_id);

    assert(list.size(record.get(window, "tabs")) === 0);

    record.remove(window_ids, window_id);

    assert(list.get(windows, index) === window_id);

    list.remove(windows, index);

    event.send(events, json);
  },

  "tag-create": (json) => {
    const tag = record.get(json, "tag");

    const tag_id = record.get(tag, "id");

    assert(list.size(record.get(tag, "tabs")) === 0);

    record.insert(tag_ids, tag_id, tag);

    event.send(events, json);
  },

  "tag-insert-tab": (json) => {
    const tag_id = record.get(json, "tag-id");
    const tab_id = record.get(json, "tab-id");
    const time   = record.get(json, "tag-time");

    const tag  = record.get(tag_ids, tag_id);
    const tab  = record.get(tab_ids, tab_id);
    const tabs = record.get(tag, "tabs");

    record.insert(record.get(tab, "tags"), tag_id, time);

    list.push(tabs, tab_id);

    event.send(events, json);
  },

  "tag-remove-tab": (json) => {
    const tab_id = record.get(json, "tab-id");
    const tag_id = record.get(json, "tag-id");
    const index  = record.get(json, "tab-index");

    const tag  = record.get(tag_ids, tag_id);
    const tab  = record.get(tab_ids, tab_id);
    const tabs = record.get(tag, "tabs");

    record.remove(record.get(tab, "tags"), tag_id);

    assert(list.get(tabs, index) === tab_id);
    list.remove(tabs, index);

    // TODO is this correct ?
    assert(list.size(tabs) > 0);

    event.send(events, json);
  },

  "tag-remove": (json) => {
    const tag_id = record.get(json, "tag-id");

    const tag = record.get(tag_ids, tag_id);

    assert(list.size(record.get(tag, "tabs")) === 0);

    record.remove(tag_ids, tag_id);

    event.send(events, json);
  }
});

ports.on_receive(port, (x) => {
  record.get(types, record.get(x, "type"))(x);
});
