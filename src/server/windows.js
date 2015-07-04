import { uuid_port_tab } from "../common/uuid";
import { init as init_chrome } from "../chrome/server";
import { init as init_session } from "./session";
import { init as init_db } from "./migrate";
import { each, map, foldl } from "../util/iterator";
import { timestamp } from "../util/time";
import { assert, fail } from "../util/assert";
import { List } from "../util/immutable/list";
import { Record } from "../util/immutable/record";
import { Set } from "../util/mutable/set"; // TODO this is only needed for development
import { async } from "../util/async";


export const init = async(function* () {
  const db = yield init_db;
  const { windows, tabs, ports } = yield init_chrome;
  const session = yield init_session;

  let saved_windows = db.get("current.windows", List());
  let window_ids    = db.get("current.window-ids", Record());
  let tab_ids       = db.get("current.tab-ids", Record());

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
  // TODO more checks (e.g. that the indexes are correct)
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
  const update_time = (x, s) =>
    x.update("time", (time) => {
      if (time.has(s)) {
        return time.set(s, timestamp());
      } else {
        return time.add(s, timestamp());
      }
    });

  const update_tab = (tab_id, info) => {
    const old_tab_ids = tab_ids;

    tab_ids = tab_ids.update(tab_id, (old_tab) => {
      const new_tab = old_tab.set("url", info.url)
                             .set("title", info.title)
                             .set("favicon", info.favicon)
                             .set("pinned", info.pinned);

      // TODO test this
      if (old_tab === new_tab) {
        return old_tab;

      } else {
        return update_time(new_tab, "updated");
      }
    });

    save_tab_ids();

    // TODO test this
    return tab_ids !== old_tab_ids;
  };

  const make_new_tab = (window_id, tab_id, info) => {
    const tab = Record([
      ["id", tab_id],
      ["window", window_id],
      ["url", info.url],
      ["title", info.title],
      ["favicon", info.favicon],
      ["pinned", info.pinned],

      ["time", Record([
        ["created", timestamp()],
        //["updated", null],
        //["unloaded", null],
        //["focused", null],
        //["moved-in-window", null],
        //["moved-to-window", null]
      ])],

      ["tags", Record()]
    ]);

    tab_ids = tab_ids.add(tab_id, tab);

    save_tab_ids();
  };

  const update_window = (window_id, info) => {
    window_ids = update_tabs(window_ids, window_id, (tabs) =>
      foldl(tabs, info.tabs, (tabs, info) => {
        const tab_id = session.tab_id(info.id);

        if (tab_ids.has(tab_id)) {
          // TODO assert that the index is correct ?
          update_tab(tab_id, info);
          return tabs;

        } else {
          make_new_tab(window_id, tab_id, info);
          // TODO is this correct ?
          return tabs.push(tab_id);
        }
      }));

    save_window_ids();
  };

  const make_new_window = (window_id, info) => {
    const window = Record([
      ["id", window_id],
      ["name", null],

      ["tabs", List(map(info.tabs, (tab) => {
        const tab_id = session.tab_id(tab.id);
        make_new_tab(window_id, tab_id, tab);
        return tab_id;
      }))],

      ["time", Record([
        ["created", timestamp()],
        //["focused", null],
        //["unloaded", null]
      ])]
    ]);

    window_ids = window_ids.add(window_id, window);

    save_window_ids();
  };

  const update_tabs = (ids, id, f) =>
    ids.update(id, (window) =>
      window.update("tabs", f));

  const find_right_index = (window, index) => {
    // TODO a bit inefficient
    const tabs = window_ids.get(session.window_id(window.id)).get("tabs");

    // TODO test this
    const prev = window.tabs.get(index - 1);
    const prev_id = session.tab_id(prev.id);
    // TODO can this be implemented more efficiently ?
    const prev_index = tabs.index_of(prev_id);
    return prev_index + 1;
  };

  const find_left_index = (window, index) => {
    // TODO a bit inefficient
    const tabs = window_ids.get(session.window_id(window.id)).get("tabs");

    // TODO test this
    if (window.tabs.has(index + 1)) {
      const next = window.tabs.get(index + 1);
      const next_id = session.tab_id(next.id);
      // TODO can this be implemented more efficiently ?
      return tabs.index_of(next_id);

    } else {
      // TODO is this correct ?
      return tabs.size;
    }
  };

  const find_move_index = (old_window, new_window, old_index, new_index) => {
    // TODO is this check correct ?
    if (old_window === new_window) {
      // Moved to the left
      if (new_index < old_index) {
        return find_left_index(new_window, new_index);

      // Moved to the right
      } else if (new_index > old_index) {
        return find_right_index(new_window, new_index);

      } else {
        fail();
      }

    } else {
      // TODO is this correct ?
      return find_left_index(new_window, new_index);
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
      // TODO what about when reopening a closed window ?
      saved_windows = saved_windows.push(id);

      save_windows();
    }
  };

  const window_open = ({ window: info }) => {
    const id = session.window_id(info.id);

    make_new_window(id, info);

    // TODO is this correct ?
    const new_index = saved_windows.size;

    // TODO is this correct ?
    // TODO what about when reopening a closed window ?
    saved_windows = saved_windows.push(id);

    save_windows();

    ports.send(uuid_port_tab, Record([
      ["type", "window-open"],
      ["window-id", id],
      ["index", new_index],
      // TODO this is a bit inefficient
      ["window", window_ids.get(id)]
    ]));
  };

  const window_focus = (info) => {
    if (info.new !== null) {
      const id = session.window_id(info.new.id);

      window_ids = window_ids.update(id, (window) =>
        update_time(window, "focused"));

      save_window_ids();

      ports.send(uuid_port_tab, Record([
        ["type", "window-focus"],
        ["window-id", id],
        // TODO this is a bit inefficient
        ["window", window_ids.get(id)]
      ]));
    }
  };

  const window_close = ({ window: info }) => {
    const id = session.window_id(info.id);

    const tabs = window_ids.get(id).get("tabs");

    // Removes all the unloaded tabs
    // TODO test this
    each(tabs, (tab_id) => {
      tab_ids = tab_ids.remove(tab_id);
      save_tab_ids();
    });

    window_ids = window_ids.remove(id);

    // TODO can this be implemented more efficiently ?
    const index = saved_windows.index_of(id);
    saved_windows = saved_windows.remove(index);

    save_window_ids();
    save_windows();

    ports.send(uuid_port_tab, Record([
      ["type", "window-close"],
      ["window-id", id],
      ["index", index]
    ]));
  };

  const tab_open = ({ window, tab, index }) => {
    const window_id = session.window_id(window.id);
    const tab_id = session.tab_id(tab.id);

    make_new_tab(window_id, tab_id, tab);

    const new_index = find_left_index(window, index);

    window_ids = update_tabs(window_ids, window_id, (tabs) =>
      tabs.insert(new_index, tab_id));

    save_window_ids();

    ports.send(uuid_port_tab, Record([
      ["type", "tab-open"],
      ["window-id", window_id],
      ["tab-id", tab_id],
      ["index", new_index],
      // TODO this is a bit inefficient
      ["tab", tab_ids.get(tab_id)]
    ]));
  };

  const tab_focus = (info) => {
    if (info.new !== null) {
      const tab_id = session.tab_id(info.new.id);

      tab_ids = tab_ids.update(tab_id, (tab) =>
        update_time(tab, "focused"));

      save_tab_ids();

      ports.send(uuid_port_tab, Record([
        ["type", "tab-focus"],
        ["tab-id", tab_id],
        // TODO a bit inefficient
        ["tab", tab_ids.get(tab_id)]
      ]));
    }
  };

  const tab_update = ({ tab }) => {
    const tab_id = session.tab_id(tab.id);

    if (update_tab(tab_id, tab)) {
      ports.send(uuid_port_tab, Record([
        ["type", "tab-update"],
        ["tab-id", tab_id],
        // TODO this is a bit inefficient
        ["tab", tab_ids.get(tab_id)]
      ]));
    }
  };

  // TODO test this
  const tab_move = ({ tab, old_window, new_window, old_index, new_index }) => {
    const tab_id = session.tab_id(tab.id);

    const old_window_id = session.window_id(old_window.id);
    const new_window_id = session.window_id(new_window.id);


    // TODO is this check correct ?
    if (old_window === new_window) {
      tab_ids = tab_ids.update(tab_id, (tab) => {
        assert(tab.get("window") === old_window_id);
        assert(tab.get("window") === new_window_id);
        return update_time(tab, "moved-in-window");
      });

    } else {
      tab_ids = tab_ids.update(tab_id, (tab) => {
        assert(tab.get("window") === old_window_id);
        assert(tab.get("window") !== new_window_id);
        // TODO remove the timestamp for "moved-in-window" ?
        return update_time(tab.set("window", new_window_id), "moved-to-window");
      });
    }


    // TODO a bit hacky
    const old_tabs = window_ids.get(old_window_id).get("tabs");

    // TODO can this be implemented more efficiently ?
    const session_old_index = old_tabs.index_of(tab_id);

    window_ids = update_tabs(window_ids, old_window_id, (tabs) =>
      tabs.remove(session_old_index));


    const session_new_index = find_move_index(old_window, new_window, old_index, new_index);

    window_ids = update_tabs(window_ids, new_window_id, (tabs) =>
      tabs.insert(session_new_index, tab_id));


    save_tab_ids();
    save_window_ids();


    ports.send(uuid_port_tab, Record([
      ["type", "tab-move"],
      ["old-window-id", old_window_id],
      ["new-window-id", new_window_id],
      ["tab-id", tab_id],
      ["old-index", session_old_index],
      ["new-index", session_new_index],
      // TODO this is a bit inefficient
      ["tab", tab_ids.get(tab_id)]
    ]));
  };

  const tab_close = (info) => {
    if (info.window_closing) {
      delay();
    }

    const window_id = session.window_id(info.window.id);
    const tab_id = session.tab_id(info.tab.id);

    tab_ids = tab_ids.remove(tab_id);

    // TODO a bit hacky
    // TODO can this be implemented more efficiently ?
    const index = window_ids.get(window_id).get("tabs").index_of(tab_id);

    window_ids = update_tabs(window_ids, window_id, (tabs) =>
      tabs.remove(index));

    save_window_ids();
    save_tab_ids();

    ports.send(uuid_port_tab, Record([
      ["type", "tab-close"],
      ["window-id", window_id],
      ["tab-id", tab_id],
      ["index", index]
    ]));
  };


  check_integrity();
  each(windows.get(), window_init);
  check_integrity();

  windows.on_open.listen((info) => {
    session.window_open(info);
    window_open(info);
  });

  windows.on_close.listen((info) => {
    window_close(info);
    // This must be after `window_close`
    session.window_close(info);
  });

  windows.on_focus.listen((info) => {
    window_focus(info);
  });

  tabs.on_open.listen((info) => {
    session.tab_open(info);
    tab_open(info);
  });

  tabs.on_close.listen((info) => {
    tab_close(info);
    // This must be after `tab_close`
    session.tab_close(info);
  });

  tabs.on_focus.listen((info) => {
    tab_focus(info);
  });

  tabs.on_move.listen((info) => {
    session.tab_move(info);
    tab_move(info);
  });

  tabs.on_update.listen((info) => {
    session.tab_update(info);
    tab_update(info);
  });

  tabs.on_replace.listen((info) => {
    session.tab_replace(info);
  });

  ports.on_connect.listen((port) => {
    if (port.name === uuid_port_tab) {
      port.send(Record([
        ["type", "init"],
        ["windows", saved_windows],
        ["window-ids", window_ids],
        ["tab-ids", tab_ids]
      ]));
    }
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