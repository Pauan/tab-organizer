import { uuid_port_tab } from "../../common/uuid";
import { Ref } from "../../util/ref";
import { Event } from "../../util/event";
import { init as init_chrome } from "../../chrome/client";
import { async, async_callback } from "../../util/async";
import { assert } from "../../util/assert";


const windows    = new Ref(null);
const window_ids = new Ref(null);
const tab_ids    = new Ref(null);

const events     = new Event();


const update_tabs = (id, f) => {
  window_ids.value = window_ids.value.update(id, (window) =>
    window.update("tabs", f));
};

const handlers = {
  "init": (info) => {
    assert(windows.value    === null);
    assert(window_ids.value === null);
    assert(tab_ids.value    === null);

    windows.value    = info.get("windows");
    window_ids.value = info.get("window-ids");
    tab_ids.value    = info.get("tab-ids");
  },

  "window-open": (info) => {
    const id = info.get("window-id");
    const window = info.get("window");
    const index = info.get("index");

    assert(window.get("id") === id);

    window_ids.value = window_ids.value.add(id, window);
    windows.value = windows.value.insert(index, id);
  },

  "window-focus": (info) => {
    const id = info.get("window-id");
    const window = info.get("window");

    assert(window.get("id") === id);

    window_ids.value = window_ids.value.set(id, window);
  },

  "window-close": (info) => {
    const id = info.get("window-id");
    const index = info.get("index");

    assert(windows.value.get(index) === id);

    windows.value = windows.value.remove(index);
  },

  "tab-open": (info) => {
    const window_id = info.get("window-id");
    const tab_id = info.get("tab-id");
    const index = info.get("index");
    const tab = info.get("tab");

    assert(tab.get("id") === tab_id);
    assert(tab.get("window") === window_id);

    tab_ids.value = tab_ids.value.add(tab_id, tab);

    update_tabs(window_id, (tabs) =>
      tabs.insert(index, tab_id));
  },

  "tab-focus": (info) => {
    const id = info.get("tab-id");
    const tab = info.get("tab");

    assert(tab.get("id") === id);

    tab_ids.value = tab_ids.value.set(id, tab);
  },

  // TODO code duplication with "tab-focus"
  "tab-update": (info) => {
    const id = info.get("tab-id");
    const tab = info.get("tab");

    assert(tab.get("id") === id);

    tab_ids.value = tab_ids.value.set(id, tab);
  },

  "tab-move": (info) => {
    const tab_id = info.get("tab-id");
    const tab = info.get("tab");

    const old_window_id = info.get("old-window-id");
    const new_window_id = info.get("new-window-id");

    const old_index = info.get("old-index");
    const new_index = info.get("new-index");

    tab_ids.value = tab_ids.value.set(tab_id, tab);

    update_tabs(old_window_id, (tabs) => {
      assert(tabs.get(old_index) === tab_id);
      return tabs.remove(old_index);
    });

    update_tabs(new_window_id, (tabs) =>
      tabs.insert(new_index, tab_id));
  },

  "tab-close": (info) => {
    const window_id = info.get("window-id");
    const tab_id = info.get("tab-id");
    const index = info.get("index");

    tab_ids.value = tab_ids.value.remove(tab_id);

    update_tabs(window_id, (tabs) => {
      assert(tabs.get(index) === tab_id);
      return tabs.remove(index);
    });
  }
};


// TODO test this
const ready = async_callback((success, error) => {
  // TODO a bit hacky
  const x = events.listen((message) => {
    if (message.get("type") === "init") {
      success(undefined);
      // TODO test this
      x.unlisten();
    }
  });
});

export const sync = async(function* () {
  const { ports } = yield init_chrome;

  const port = ports.connect(uuid_port_tab);

  port.on_receive.listen((message) => {
    const type = message.get("type");

    handlers[type](message);
    events.send(message);
  });

  yield ready;

  return { windows, window_ids, tab_ids };
});
