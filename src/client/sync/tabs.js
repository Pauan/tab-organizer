import { uuid_port_tab } from "../../common/uuid";
import { Event } from "../../util/event";
import { Table } from "../../util/table";
import { init as init_chrome } from "../../chrome/client";
import { async, async_callback } from "../../util/async";
import { assert } from "../../util/assert";


const events = new Event();
const table  = new Table();


const update_tabs = (table, id, f) => {
  table.update("window-ids", (window_ids) =>
    window_ids.update(id, (window) => {
      assert(window.get("id") === id);
      return window.update("tabs", f);
    }));
};

const handlers = {
  "init": (info) => {
    table.transaction((table) => {
      table.add("windows",    info.get("windows"));
      table.add("window-ids", info.get("window-ids"));
      table.add("tab-ids",    info.get("tab-ids"));
    });
  },

  "window-open": (info) => {
    const id = info.get("window-id");
    const window = info.get("window");
    const index = info.get("index");

    assert(window.get("id") === id);

    table.transaction((table) => {
      table.update("window-ids", (window_ids) => window_ids.add(id, window));
      table.update("windows", (windows) => windows.insert(index, id));
    });
  },

  "window-focus": (info) => {
    const id = info.get("window-id");
    const window = info.get("window");

    assert(window.get("id") === id);

    table.update("window-ids", (window_ids) => window_ids.set(id, window));
  },

  "window-close": (info) => {
    const id = info.get("window-id");
    const index = info.get("index");

    table.update("windows", (windows) => {
      assert(windows.get(index) === id);
      return windows.remove(index);
    });
  },

  "tab-open": (info) => {
    const window_id = info.get("window-id");
    const tab_id = info.get("tab-id");
    const index = info.get("index");
    const tab = info.get("tab");

    assert(tab.get("id") === tab_id);
    assert(tab.get("window") === window_id);

    table.transaction((table) => {
      table.update("tab-ids", (tab_ids) => tab_ids.add(tab_id, tab));
      update_tabs(table, window_id, (tabs) => tabs.insert(index, tab_id));
    });
  },

  "tab-focus": (info) => {
    const id = info.get("tab-id");
    const tab = info.get("tab");

    assert(tab.get("id") === id);

    table.update("tab-ids", (tab_ids) => tab_ids.set(id, tab));
  },

  // TODO code duplication with "tab-focus"
  "tab-update": (info) => {
    const id = info.get("tab-id");
    const tab = info.get("tab");

    assert(tab.get("id") === id);

    table.update("tab-ids", (tab_ids) => tab_ids.set(id, tab));
  },

  "tab-move": (info) => {
    const tab_id = info.get("tab-id");
    const tab = info.get("tab");

    const old_window_id = info.get("old-window-id");
    const new_window_id = info.get("new-window-id");

    const old_index = info.get("old-index");
    const new_index = info.get("new-index");

    table.transaction((table) => {
      table.update("tab-ids", (tab_ids) => tab_ids.set(tab_id, tab));

      update_tabs(table, old_window_id, (tabs) => {
        assert(tabs.get(old_index) === tab_id);
        return tabs.remove(old_index);
      });

      update_tabs(table, new_window_id, (tabs) =>
        tabs.insert(new_index, tab_id));
    });
  },

  "tab-close": (info) => {
    const window_id = info.get("window-id");
    const tab_id = info.get("tab-id");
    const index = info.get("index");

    table.transaction((table) => {
      table.update("tab-ids", (tab_ids) => tab_ids.remove(tab_id));

      update_tabs(table, window_id, (tabs) => {
        assert(tabs.get(index) === tab_id);
        return tabs.remove(index);
      });
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

  return { table };
});
