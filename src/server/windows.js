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
  const { windows, tabs } = yield init_chrome;
  const session = yield init_session;
  const { sync } = yield init_sync;


  db.default(["current.windows"], List());
  db.default(["current.window-ids"], Record());
  db.default(["current.tab-ids"], Record());

  sync(db, "current.windows");
  sync(db, "current.window-ids");
  sync(db, "current.tab-ids");


  const delay = (ms) => {
    db.delay("current.windows", ms);
    db.delay("current.window-ids", ms);
    db.delay("current.tab-ids", ms);
  };


  // TODO this can be removed for the final release, it's only for development
  // TODO more checks (e.g. that the indexes are correct)
  const check_integrity = () => {
    const windows    = db.get(["current.windows"]);
    const window_ids = db.get(["current.window-ids"]);
    const tab_ids    = db.get(["current.tab-ids"]);

    const seen = new Set();

    each(windows, (id) => {
      assert(window_ids.has(id));
      seen.add(id);
    });

    each(window_ids, ([id, window]) => {
      assert(window.get("id") === id);
      windows.index_of(id).get();

      const seen = new Set();

      each(window.get("tabs"), (id) => {
        assert(tab_ids.has(id));
        seen.add(id);
      });
    });

    each(tab_ids, ([id, tab]) => {
      assert(tab.get("id") === id);

      const window = window_ids.get(tab.get("window"));

      window.get("tabs").index_of(id).get();
    });
  };


  const update_tab = (db, tab_id, info) => {
    const old_tab = db.get(["current.tab-ids", tab_id]);

    db.update(["current.tab-ids", tab_id, "url"], info.url);
    db.update(["current.tab-ids", tab_id, "title"], info.title);
    db.update(["current.tab-ids", tab_id, "favicon"], info.favicon);
    db.update(["current.tab-ids", tab_id, "pinned"], info.pinned);

    const new_tab = db.get(["current.tab-ids", tab_id]);

    // TODO is this correct ?
    if (old_tab !== new_tab) {
      db.assign(["current.tab-ids", tab_id, "time", "updated"], timestamp());
    }
  };

  const make_new_tab = (db, window_id, tab_id, info) => {
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

    db.insert(["current.tab-ids", tab_id], tab);
  };

  const update_window = (db, window_id, info) => {
    const tab_ids = db.get(["current.tab-ids"]);

    each(info.tabs, (info) => {
      const tab_id = session.tab_id(info.id);

      if (tab_ids.has(tab_id)) {
        // TODO assert that the index is correct ?
        update_tab(db, tab_id, info);

      } else {
        make_new_tab(db, window_id, tab_id, info);

        // TODO is this correct ?
        db.push(["current.window-ids", window_id, "tabs"], tab_id);
      }
    });
  };

  const make_new_window = (db, window_id, info) => {
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

    db.insert(["current.window-ids", window_id], window);
  };

  const find_right_index = (tabs, window, index) => {
    // TODO test this
    const prev = window.tabs.get(index - 1);
    const prev_id = session.tab_id(prev.id);
    // TODO can this be implemented more efficiently ?
    const prev_index = tabs.index_of(prev_id).get();
    return prev_index + 1;
  };

  const find_left_index = (tabs, window, index) => {
    // TODO test this
    if (window.tabs.has(index + 1)) {
      const next = window.tabs.get(index + 1);
      const next_id = session.tab_id(next.id);
      // TODO can this be implemented more efficiently ?
      return tabs.index_of(next_id).get();

    } else {
      // TODO is this correct ?
      return tabs.size;
    }
  };


  const window_init = (db, info) => {
    const id = session.window_id(info.id);

    // TODO this is a little inefficient
    const window_ids = db.get(["current.window-ids"]);

    // TODO is this correct ?
    if (window_ids.has(id)) {
      // TODO assert that the index is correct ?
      update_window(db, id, info);

    } else {
      make_new_window(db, id, info);

      // TODO is this correct ?
      // TODO what about when reopening a closed window ?
      db.push(["current.windows"], id);
    }
  };

  const window_open = ({ window: info }) => {
    db.transaction((db) => {
      const id = session.window_id(info.id);

      make_new_window(db, id, info);

      // TODO is this correct ?
      // TODO what about when reopening a closed window ?
      db.push(["current.windows"], id);
    });
  };

  const window_focus = (info) => {
    db.transaction((db) => {
      if (info.new !== null) {
        const id = session.window_id(info.new.id);

        db.assign(["current.window-ids", id, "time", "focused"], timestamp());
      }
    });
  };

  const window_close = ({ window: info }) => {
    db.transaction((db) => {
      const id = session.window_id(info.id);

      const tabs = db.get(["current.window-ids", id, "tabs"]);

      // Removes all the unloaded tabs
      // TODO test this
      each(tabs, (tab_id) => {
        db.remove(["current.tab-ids", tab_id]);
      });

      db.remove(["current.window-ids", id]);

      // TODO can this be implemented more efficiently ?
      const index = db.get(["current.windows"]).index_of(id).get();

      db.remove(["current.windows", index]);
    });
  };

  const tab_open = ({ window, tab, index }) => {
    db.transaction((db) => {
      const window_id = session.window_id(window.id);
      const tab_id = session.tab_id(tab.id);

      make_new_tab(db, window_id, tab_id, tab);

      const tabs = db.get(["current.window-ids", window_id, "tabs"]);

      const session_index = find_left_index(tabs, window, index);

      db.insert(["current.window-ids", window_id, "tabs", session_index], tab_id);
    });
  };

  const tab_focus = (info) => {
    db.transaction((db) => {
      if (info.new !== null) {
        const tab_id = session.tab_id(info.new.id);

        db.assign(["current.tab-ids", tab_id, "time", "focused"], timestamp());
      }
    });
  };

  const tab_update = ({ tab }) => {
    db.transaction((db) => {
      const tab_id = session.tab_id(tab.id);

      update_tab(db, tab_id, tab);
    });
  };

  // TODO test this
  const tab_move = ({ tab, old_window, new_window, old_index, new_index }) => {
    db.transaction((db) => {
      const tab_id = session.tab_id(tab.id);

      const old_window_id = session.window_id(old_window.id);
      const new_window_id = session.window_id(new_window.id);


      db.update(["current.tab-ids", tab_id, "window"], new_window_id);

      // TODO what if it wasn't moved ?
      db.assign(["current.tab-ids", tab_id, "time", "moved"], timestamp());


      const old_tabs = db.get(["current.window-ids", old_window_id, "tabs"]);

      const session_old_index = old_tabs.index_of(tab_id).get();

      db.remove(["current.window-ids", old_window_id, "tabs", session_old_index]);


      const new_tabs = db.get(["current.window-ids", new_window_id, "tabs"]);

      // TODO a little bit inefficient
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

      db.insert(["current.window-ids", new_window_id, "tabs", session_new_index],
                tab_id);
    });
  };

  const tab_close = (info) => {
    db.transaction((db) => {
      // Delay by 10 seconds, so that when Chrome closes,
      // it doesn't remove the tabs / windows
      // TODO is this place correct ?
      if (info.window_closing) {
        delay(10000);
      }

      const window_id = session.window_id(info.window.id);
      const tab_id = session.tab_id(info.tab.id);

      db.remove(["current.tab-ids", tab_id]);

      const tabs = db.get(["current.window-ids", window_id, "tabs"]);

      // TODO can this be implemented more efficiently ?
      const index = tabs.index_of(tab_id).get();

      db.remove(["current.window-ids", window_id, "tabs", index]);
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


  windows.on_open.each((info) => {
    session.window_open(info);
    window_open(info);
  });

  windows.on_close.each((info) => {
    window_close(info);
    // This must be after `window_close`
    session.window_close(info);
  });

  windows.on_focus.each((info) => {
    window_focus(info);
  });

  tabs.on_open.each((info) => {
    session.tab_open(info);
    tab_open(info);
  });

  tabs.on_close.each((info) => {
    tab_close(info);
    // This must be after `tab_close`
    session.tab_close(info);
  });

  tabs.on_focus.each((info) => {
    tab_focus(info);
  });

  tabs.on_move.each((info) => {
    session.tab_move(info);
    tab_move(info);
  });

  tabs.on_update.each((info) => {
    session.tab_update(info);
    tab_update(info);
  });

  tabs.on_replace.each((info) => {
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
