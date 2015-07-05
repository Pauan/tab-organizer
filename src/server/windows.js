import { uuid_port_tab } from "../common/uuid";
import { init as init_chrome } from "../chrome/server";
import { init as init_session } from "./session";
import { init as init_db } from "./migrate";
import { init as init_sync } from "./sync";
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
  const sync = yield init_sync;


  db.default("current.windows", List());
  db.default("current.window-ids", Record());
  db.default("current.tab-ids", Record());

  sync("current.windows");
  sync("current.window-ids");
  sync("current.tab-ids");


  const default_delay = 1000;

  const delay = (ms) => {
    db.delay("current.windows", ms);
    db.delay("current.window-ids", ms);
    db.delay("current.tab-ids", ms);
  };


  // TODO this can be removed for the final release, it's only for development
  // TODO more checks (e.g. that the indexes are correct)
  const check_integrity = () => {
    const windows    = db.get("current.windows");
    const window_ids = db.get("current.window-ids");
    const tab_ids    = db.get("current.tab-ids");

    const seen = new Set();

    each(windows, (id) => {
      assert(window_ids.has(id));
      seen.add(id);
    });

    each(window_ids, ([id, window]) => {
      assert(window.get("id") === id);
      windows.index_of(id);

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

  const update_tabs = (db, id, f) => {
    delay(default_delay);

    db.update("current.window-ids", (window_ids) =>
      window_ids.update(id, (window) =>
        window.update("tabs", f)));
  };

  const update_tab = (db, tab_id, info) => {
    delay(default_delay);

    db.update("current.tab-ids", (tab_ids) =>
      tab_ids.update(tab_id, (old_tab) => {
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
      }));
  };

  const make_new_tab = (db, window_id, tab_id, info) => {
    delay(default_delay);

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

    db.update("current.tab-ids", (tab_ids) => tab_ids.add(tab_id, tab));

    return tab;
  };

  const update_window = (db, window_id, info) => {
    const tab_ids = db.get("current.tab-ids");

    update_tabs(db, window_id, (tabs) =>
      foldl(tabs, info.tabs, (tabs, info) => {
        const tab_id = session.tab_id(info.id);

        if (tab_ids.has(tab_id)) {
          // TODO assert that the index is correct ?
          update_tab(db, tab_id, info);
          return tabs;

        } else {
          make_new_tab(db, window_id, tab_id, info);
          // TODO is this correct ?
          return tabs.push(tab_id);
        }
      }));
  };

  const make_new_window = (db, window_id, info) => {
    delay(default_delay);

    const window = Record([
      ["id", window_id],
      ["name", null],

      ["tabs", List(map(info.tabs, (tab) => {
        const tab_id = session.tab_id(tab.id);
        make_new_tab(db, window_id, tab_id, tab);
        return tab_id;
      }))],

      ["time", Record([
        ["created", timestamp()],
        //["focused", null],
        //["unloaded", null]
      ])]
    ]);

    db.update("current.window-ids", (window_ids) =>
      window_ids.add(window_id, window));
  };

  const find_right_index = (tabs, window, index) => {
    // TODO test this
    const prev = window.tabs.get(index - 1);
    const prev_id = session.tab_id(prev.id);
    // TODO can this be implemented more efficiently ?
    const prev_index = tabs.index_of(prev_id);
    return prev_index + 1;
  };

  const find_left_index = (tabs, window, index) => {
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


  const window_init = (db, info) => {
    const id = session.window_id(info.id);

    // TODO this is a little inefficient
    const window_ids = db.get("current.window-ids");

    // TODO is this correct ?
    if (window_ids.has(id)) {
      // TODO assert that the index is correct ?
      update_window(db, id, info);

    } else {
      delay(default_delay);

      make_new_window(db, id, info);

      // TODO is this correct ?
      // TODO what about when reopening a closed window ?
      db.update("current.windows", (windows) => windows.push(id));
    }
  };

  const window_open = ({ window: info }) => {
    db.transaction((db) => {
      delay(default_delay);

      const id = session.window_id(info.id);

      make_new_window(db, id, info);

      const window_ids = db.get("current.window-ids");
      const windows    = db.get("current.windows");

      // TODO is this correct ?
      const new_index = windows.size;

      // TODO is this correct ?
      // TODO what about when reopening a closed window ?
      db.set("current.windows", windows.push(id));

      ports.send(uuid_port_tab, Record([
        ["type", "window-open"],
        ["window-id", id],
        ["index", new_index],
        // TODO this is a bit inefficient
        ["window", window_ids.get(id)]
      ]));
    });
  };

  const window_focus = (info) => {
    if (info.new !== null) {
      delay(default_delay);

      const id = session.window_id(info.new.id);

      const window_ids = db.get("current.window-ids");
      const window     = window_ids.get(id);

      db.set("current.window-ids",
        window_ids.set(id, update_time(window, "focused")));

      ports.send(uuid_port_tab, Record([
        ["type", "window-focus"],
        ["window-id", id],
        // TODO this is a bit inefficient
        ["window", window]
      ]));
    }
  };

  const window_close = ({ window: info }) => {
    db.transaction((db) => {
      delay(default_delay);

      const id = session.window_id(info.id);

      const windows    = db.get("current.windows");
      const window_ids = db.get("current.window-ids");
      const tab_ids    = db.get("current.tab-ids");

      // TODO can this be implemented more efficiently ?
      const index = windows.index_of(id);

      const tabs = window_ids.get(id).get("tabs");

      // Removes all the unloaded tabs
      // TODO test this
      db.set("current.tab-ids",
        foldl(tab_ids, tabs, (tab_ids, tab_id) =>
          tab_ids.remove(tab_id)));

      db.set("current.window-ids", window_ids.remove(id));

      assert(windows.get(index) === id);
      db.set("current.windows", windows.remove(index));

      ports.send(uuid_port_tab, Record([
        ["type", "window-close"],
        ["window-id", id],
        ["index", index]
      ]));
    });
  };

  const tab_open = ({ window, tab, index }) => {
    db.transaction((db) => {
      const window_id = session.window_id(window.id);
      const tab_id = session.tab_id(tab.id);

      const new_tab = make_new_tab(db, window_id, tab_id, tab);

      const tabs = db.get("current.window-ids")
                     .get(window_id)
                     .get("tabs");

      const new_index = find_left_index(tabs, window, index);

      update_tabs(db, window_id, (tabs) =>
        tabs.insert(new_index, tab_id));

      ports.send(uuid_port_tab, Record([
        ["type", "tab-open"],
        ["window-id", window_id],
        ["tab-id", tab_id],
        ["index", new_index],
        ["tab", new_tab]
      ]));
    });
  };

  const tab_focus = (info) => {
    if (info.new !== null) {
      delay(default_delay);

      const tab_id = session.tab_id(info.new.id);

      const tab_ids = db.get("current.tab-ids");
      const old_tab = tab_ids.get(tab_id);
      const new_tab = update_time(old_tab, "focused");

      db.set("current.tab-ids", tab_ids.set(tab_id, new_tab));

      ports.send(uuid_port_tab, Record([
        ["type", "tab-focus"],
        ["tab-id", tab_id],
        ["tab", new_tab]
      ]));
    }
  };

  const tab_update = ({ tab }) => {
    const tab_id = session.tab_id(tab.id);

    const old_tab_ids = db.get("current.tab-ids");

    update_tab(db, tab_id, tab);

    const new_tab_ids = db.get("current.tab-ids");

    // TODO test this
    if (new_tab_ids !== old_tab_ids) {
      ports.send(uuid_port_tab, Record([
        ["type", "tab-update"],
        ["tab-id", tab_id],
        // TODO this is a bit inefficient
        ["tab", new_tab_ids.get(tab_id)]
      ]));
    }
  };

  // TODO test this
  const tab_move = ({ tab, old_window, new_window, old_index, new_index }) => {
    db.transaction((db) => {
      delay(default_delay);

      const tab_id = session.tab_id(tab.id);

      const old_window_id = session.window_id(old_window.id);
      const new_window_id = session.window_id(new_window.id);


      const tab_ids = db.get("current.tab-ids");
      const old_tab = tab_ids.get(tab_id);

      // TODO a bit inefficient
      const new_tab = (() => {
        // TODO is this check correct ?
        if (old_window === new_window) {
          assert(old_tab.get("window") === old_window_id);
          assert(old_tab.get("window") === new_window_id);
          return update_time(old_tab, "moved-in-window");

        } else {
          assert(old_tab.get("window") === old_window_id);
          assert(old_tab.get("window") !== new_window_id);
          // TODO remove the timestamp for "moved-in-window" ?
          return update_time(old_tab.set("window", new_window_id), "moved-to-window");
        }
      })();

      db.set("current.tab-ids", tab_ids.set(tab_id, new_tab));


      // TODO a bit hacky
      const old_tabs = db.get("current.window-ids")
                         .get(old_window_id)
                         .get("tabs");

      // TODO can this be implemented more efficiently ?
      const session_old_index = old_tabs.index_of(tab_id);

      update_tabs(db, old_window_id, (tabs) => {
        assert(tabs.get(session_old_index) === tab_id);
        return tabs.remove(session_old_index);
      });


      // TODO a bit hacky
      const new_tabs = db.get("current.window-ids")
                         .get(new_window_id)
                         .get("tabs");

      // TODO a bit inefficient
      const session_new_index = (() => {
        // TODO is this check correct ?
        if (old_window === new_window) {
          // Moved to the left
          if (new_index < old_index) {
            return find_left_index(new_tabs, new_window, new_index);

          // Moved to the right
          } else if (new_index > old_index) {
            return find_right_index(new_tabs, new_window, new_index);

          } else {
            fail();
          }

        } else {
          // TODO is this correct ?
          return find_left_index(new_tabs, new_window, new_index);
        }
      })();

      update_tabs(db, new_window_id, (tabs) =>
        tabs.insert(session_new_index, tab_id));


      ports.send(uuid_port_tab, Record([
        ["type", "tab-move"],
        ["old-window-id", old_window_id],
        ["new-window-id", new_window_id],
        ["tab-id", tab_id],
        ["old-index", session_old_index],
        ["new-index", session_new_index],
        ["tab", new_tab]
      ]));
    });
  };

  const tab_close = (info) => {
    db.transaction((db) => {
      if (info.window_closing) {
        // Delay by 10 seconds, so that when Chrome closes,
        // it doesn't remove the tabs / windows
        delay(10000);
      } else {
        delay(default_delay);
      }

      const window_id = session.window_id(info.window.id);
      const tab_id = session.tab_id(info.tab.id);

      // TODO a bit hacky
      // TODO can this be implemented more efficiently ?
      const index = db.get("current.window-ids")
                      .get(window_id)
                      .get("tabs")
                      .index_of(tab_id);

      db.update("current.tab-ids", (tab_ids) => tab_ids.remove(tab_id));

      update_tabs(db, window_id, (tabs) => {
        assert(tabs.get(index) === tab_id);
        return tabs.remove(index);
      });

      ports.send(uuid_port_tab, Record([
        ["type", "tab-close"],
        ["window-id", window_id],
        ["tab-id", tab_id],
        ["index", index]
      ]));
    });
  };


  // This must go before `window_init`
  session.init(windows.get());


  check_integrity();

  // TODO time this
  db.transaction((db) => {
    each(windows.get(), (info) => {
      window_init(db, info);
    });
  });

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
        ["windows", db.get("current.windows")],
        ["window-ids", db.get("current.window-ids")],
        ["tab-ids", db.get("current.tab-ids")]
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
