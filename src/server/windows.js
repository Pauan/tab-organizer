import { uuid_port_tab } from "../common/uuid";
import { init as init_chrome } from "../chrome/server";
import { init as init_session } from "./session";
import { init as init_db } from "./migrate";
import { each, entries, map } from "../util/iterator";
import { timestamp } from "../util/time";
import { assert, fail } from "../util/assert";
import { List } from "../util/list";
import { Record } from "../util/record";
import { async } from "../util/async";
import { Set } from "../util/set"; // TODO this is only needed for development


const deserialize_tab = (x) => {
  x["time"] = new Record(x["time"]);
  x["tags"] = new Record(x["tags"]);
  return new Record(x);
};

const deserialize_window = (x) => {
  x["time"] = new Record(x["time"]);
  x["tabs"] = new List(x["tabs"]);
  return new Record(x);
};

const deserialize_tab_ids = (x) => {
  const o = {};

  each(entries(x), ([key, value]) => {
    o[key] = deserialize_tab(value);
  });

  return new Record(o);
};

const deserialize_window_ids = (x) => {
  const o = {};

  each(entries(x), ([key, value]) => {
    o[key] = deserialize_window(value);
  });

  return new Record(o);
};

const deserialize_windows = (a) => new List(a);


export const init = async(function* () {
  const db = yield init_db;
  const { windows } = yield init_chrome;
  const session = yield init_session;

  const saved_windows = deserialize_windows(db.get("current.windows", []));
  const window_ids    = deserialize_window_ids(db.get("current.window-ids", {}));
  const tab_ids       = deserialize_tab_ids(db.get("current.tab-ids", {}));

  const save_windows = () => {
    db.set("current.windows", saved_windows);
  };

  const save_window_ids = () => {
    db.set("current.window-ids", window_ids);
  };

  const save_tab_ids = () => {
    db.set("current.tab-ids", tab_ids);
  };

  const delay = () => {
    // Delay by 10 seconds, so that when Chrome closes,
    // it doesn't remove the tabs / windows
    db.delay("current.windows", 10000);
    db.delay("current.window-ids", 10000);
    db.delay("current.tab-ids", 10000);
  };


  // TODO this can be removed for the final release, it's only for development
  const check_integrity = () => {
    const seen = new Set();

    each(saved_windows, (id) => {
      assert(window_ids.has(id));
      seen.add(id);
    });

    each(window_ids, ([id, window]) => {
      assert(window.get("id") === id);
      saved_windows.index_of(id);

      const seen = new Set();

      each(window.get("tabs"), (id) => {
        assert(tab_ids.has(id));
        seen.add(id);
      });
    });

    each(tab_ids, ([id, tab]) => {
      assert(tab.get("id") === id);

      const window = window_ids.get(tab.get("window"));

      window.get("tabs").index_of(id);
    });
  };


  // TODO test this
  const update_time = (time, s) => {
    if (time.has(s)) {
      time.set(s, timestamp());
    } else {
      time.add(s, timestamp());
    }
  };

  const update_tab = (tab_id, info) => {
    const tab = tab_ids.get(tab_id);

    if (tab.get("url")     !== info.url     ||
        tab.get("title")   !== info.title   ||
        tab.get("favicon") !== info.favicon ||
        tab.get("pinned")  !== info.pinned) {

      tab.set("url", info.url);
      tab.set("title", info.title);
      tab.set("favicon", info.favicon);
      tab.set("pinned", info.pinned);

      update_time(tab.get("time"), "updated");

      save_tab_ids();
    }
  };

  const make_new_tab = (window_id, tab_id, info) => {
    const tab = new Record({
      "id": tab_id,
      "window": window_id,
      "url": info.url,
      "title": info.title,
      "favicon": info.favicon,
      "pinned": info.pinned,

      "time": new Record({
        "created": timestamp(),
        //"updated": null,
        //"unloaded": null,
        //"focused": null,
        //"moved-in-window": null,
        //"moved-to-window": null
      }),

      "tags": new Record({})
    });

    tab_ids.add(tab_id, tab);

    save_tab_ids();
  };

  const update_window = (window_id, info) => {
    const window = window_ids.get(window_id);

    const tabs = window.get("tabs");

    each(info.tabs, (info) => {
      const tab_id = session.tab_id(info.id);

      if (tab_ids.has(tab_id)) {
        // TODO assert that the index is correct ?
        update_tab(tab_id, info);

      } else {
        make_new_tab(window_id, tab_id, info);

        // TODO is this correct ?
        tabs.push(tab_id);

        save_window_ids();
      }
    });
  };

  const make_new_window = (window_id, info) => {
    const window = new Record({
      "id": window_id,
      "name": null,

      "tabs": new List(map(info.tabs, (tab) => {
        const tab_id = session.tab_id(tab.id);
        make_new_tab(window_id, tab_id, tab);
        return tab_id;
      })),

      "time": new Record({
        "created": timestamp(),
        //"focused": null,
        //"unloaded": null
      })
    });

    window_ids.add(window_id, window);

    save_window_ids();
  };

  const insert_to_right = (window, tabs, index, tab_id) => {
    // TODO test this
    const prev = window.tabs.get(index - 1);
    const prev_id = session.tab_id(prev.id);
    // TODO can this be implemented more efficiently ?
    const prev_index = tabs.index_of(prev_id);
    tabs.insert(prev_index + 1, tab_id);
  };

  const insert_to_left = (window, tabs, index, tab_id) => {
    // TODO test this
    if (window.tabs.has(index + 1)) {
      const next = window.tabs.get(index + 1);
      const next_id = session.tab_id(next.id);
      // TODO can this be implemented more efficiently ?
      const next_index = tabs.index_of(next_id);
      tabs.insert(next_index, tab_id);

    } else {
      tabs.push(tab_id);
    }
  };


  const window_init = (info) => {
    const id = session.window_id(info.id);

    // TODO is this correct ?
    if (window_ids.has(id)) {
      // TODO assert that the index is correct ?
      update_window(id, info);

    } else {
      make_new_window(id, info);

      // TODO is this correct ?
      saved_windows.push(id);

      save_windows();
    }
  };

  const window_open = ({ window: info }) => {
    const id = session.window_id(info.id);

    make_new_window(id, info);

    // TODO is this correct ?
    saved_windows.push(id);

    save_windows();
  };

  const window_close = ({ window: info }) => {
    const id = session.window_id(info.id);

    const window = window_ids.get(id);

    const tabs = window.get("tabs");

    // Removes all the unloaded tabs
    each(tabs, (tab_id) => {
      tab_ids.remove(tab_id);
      save_tab_ids();
    });

    // TODO this probably isn't necessary
    tabs.clear();

    window_ids.remove(id);
    // TODO can this be implemented more efficiently ?
    saved_windows.remove(saved_windows.index_of(id));

    save_window_ids();
    save_windows();
  };

  const window_focus = (info) => {
    if (info.new !== null) {
      const id = session.window_id(info.new.id);
      const window = window_ids.get(id);
      update_time(window.get("time"), "focused");
      save_window_ids();
    }
  };

  const tab_open = ({ window, tab, index }) => {
    const window_id = session.window_id(window.id);
    const tab_id = session.tab_id(tab.id);
    const tabs = window_ids.get(window_id).get("tabs");

    make_new_tab(window_id, tab_id, tab);

    insert_to_left(window, tabs, index, tab_id);

    save_window_ids();
  };

  const tab_close = (info) => {
    if (info.window_closing) {
      delay();
    }

    const window_id = session.window_id(info.window.id);
    const tab_id = session.tab_id(info.tab.id);

    const tabs = window_ids.get(window_id).get("tabs");

    tab_ids.remove(tab_id);
    // TODO can this be implemented more efficiently ?
    tabs.remove(tabs.index_of(tab_id));

    save_window_ids();
    save_tab_ids();
  };

  const tab_focus = (info) => {
    if (info.new !== null) {
      const id = session.tab_id(info.new.id);
      const tab = tab_ids.get(id);
      update_time(tab.get("time"), "focused");
      save_tab_ids();
    }
  };

  const tab_update = ({ tab }) => {
    const tab_id = session.tab_id(tab.id);
    update_tab(tab_id, tab);
  };

  const tab_move = ({ tab, old_window, new_window, old_index, new_index }) => {
    const tab_id = session.tab_id(tab.id);
    const old_window_id = session.window_id(old_window.id);
    const new_window_id = session.window_id(new_window.id);
    const old_tabs = window_ids.get(old_window_id).get("tabs");
    const new_tabs = window_ids.get(new_window_id).get("tabs");

    // TODO can this be implemented more efficiently ?
    old_tabs.remove(old_tabs.index_of(tab_id));

    // TODO is this check correct ?
    if (old_window === new_window && old_tabs === new_tabs) {
      const tab_window = tab_ids.get(tab_id).get("window");
      assert(tab_window === old_window_id);
      assert(tab_window === new_window_id);

      // Moved to the left
      if (new_index < old_index) {
        insert_to_left(new_window, new_tabs, new_index, tab_id);

        save_window_ids();

      // Moved to the right
      } else if (new_index > old_index) {
        insert_to_right(new_window, new_tabs, new_index, tab_id);

        save_window_ids();

      } else {
        fail();
      }

    } else {
      // TODO is this correct ?
      insert_to_left(new_window, new_tabs, new_index, tab_id);

      const x = tab_ids.get(tab_id);
      assert(x.get("window") === old_window_id);
      assert(x.get("window") !== new_window_id);
      x.set("window", new_window_id);

      save_tab_ids();
      save_window_ids();
    }
  };


  check_integrity();
  each(windows.get_windows(), window_init);
  check_integrity();

  windows.on_window_open.listen((info) => {
    session.window_open(info);
    window_open(info);
  });

  windows.on_window_close.listen((info) => {
    window_close(info);
    // This must be after `window_close`
    session.window_close(info);
  });

  windows.on_window_focus.listen((info) => {
    window_focus(info);
  });

  windows.on_tab_open.listen((info) => {
    session.tab_open(info);
    tab_open(info);
  });

  windows.on_tab_close.listen((info) => {
    tab_close(info);
    // This must be after `tab_close`
    session.tab_close(info);
  });

  windows.on_tab_focus.listen((info) => {
    tab_focus(info);
  });

  windows.on_tab_move.listen((info) => {
    session.tab_move(info);
    tab_move(info);
  });

  windows.on_tab_update.listen((info) => {
    session.tab_update(info);
    tab_update(info);
  });

  windows.on_tab_replace.listen((info) => {
    session.tab_replace(info);
  });

  /*const window = yield open_window({});

  console.log(window);
  console.log(yield window.get_state());
  console.log(yield window.get_dimensions());

  console.log(yield window.set_state("maximized"));
  console.log(yield delay(1000));
  console.log(yield window.set_state("normal"));
  console.log(yield delay(1000));
  console.log(yield window.set_dimensions({ left: 50, width: 100, height: 50 }));
  console.log(yield delay(1000));
  console.log(yield window.get_dimensions());
  console.log(yield window.set_state("maximized"));
  console.log(yield delay(1000));
  console.log(yield window.get_state());
  console.log(yield window.close());*/
});
