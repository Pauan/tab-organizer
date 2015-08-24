import { uuid_port_tab } from "../common/uuid";
import { init as init_chrome } from "../chrome/server";
import { init as init_session } from "./session";
import { init as init_db } from "./migrate";
import { each, map, to_array, indexed } from "../util/iterator";
import { to_json } from "../util/json";
import { timestamp } from "../util/time";
import { assert, fail } from "../util/assert";
import { Event } from "../util/event";
import { List } from "../util/immutable/list";
import { Record } from "../util/immutable/record";
import { Set } from "../util/mutable/set"; // TODO this is only needed for development
import { async } from "../util/async";
import { Timer } from "../util/time";


export const init = async([init_db,
                           init_chrome,
                           init_session],
                          (db,
                           { windows, tabs, ports },
                           session) => {

  db.transaction((db) => {
    db.default(["current.windows"], List());
    db.default(["current.window-ids"], Record());
    db.default(["current.tab-ids"], Record());
  });

  db.transient("transient.window-ids", Record());
  db.transient("transient.tab-ids", Record());


  const tab_events = Event();

  const serialize_tab = (db, id) => {
    const tab = db.get(["current.tab-ids", id]);

    const transients = db.get(["transient.tab-ids"]);

    return {
      "id": tab.get("id"),
      "time": to_json(tab.get("time")),
      "url": tab.get("url"),
      "title": tab.get("title"),
      "favicon": tab.get("favicon"),
      "pinned": tab.get("pinned"),
      "focused": transients.has(id) && transients.get(id).focused,
      "unloaded": !transients.has(id)
    };
  };

  const serialize_window = (db, id) => {
    const window = db.get(["current.window-ids", id]);

    return {
      "id": window.get("id"),
      "name": window.get("name"),
      "tabs": to_array(map(window.get("tabs"), (id) => serialize_tab(db, id)))
    };
  };

  const serialize_windows = (db) => {
    const windows = db.get(["current.windows"]);

    return to_array(map(windows, (id) => serialize_window(db, id)));
  };

  const find_chrome_tab = (window_id, index) => {
    const tabs = db.get(["current.window-ids", window_id, "tabs"]);

    const transients = db.get(["transient.tab-ids"]);

    while (tabs.has(index)) {
      const tab_id = tabs.get(index);

      if (transients.has(tab_id)) {
        return transients.get(tab_id);
      }

      ++index;
    }

    return null;
  };

  const handle_event = {
    // TODO send out `tab_events` ?
    "move-tabs": ({ "window": window_id,
                    "tabs": tabs,
                    "index": index }) => {

      db.transaction((db) => {
        // TODO if the Chrome window doesn't exist, we should create a new one
        const chrome_window = db.get(["transient.window-ids", window_id]);
        const chrome_tab = find_chrome_tab(window_id, index);

        if (chrome_tab !== null) {
          assert(chrome_tab.window === chrome_window);
        }


        const move_tabs = [];

        each(indexed(tabs), ([i, tab_id]) => {
          /*const old_window_id = db.get(["current.tab-ids", tab_id, "window"]);
          const old_tabs = db.get(["current.window-ids", old_window_id, "tabs"]);
          const old_index = old_tabs.index_of(tab_id).get();

          db.update(["current.tab-ids", tab_id, "window"], window_id);

          db.remove(["current.window-ids", old_window_id, "tabs", old_index]);

          // TODO test this
          if (old_window_id === window_id && old_index < index) {
            db.insert(["current.window-ids", window_id, "tabs", index - 1],
                      tab_id);

          } else {
            db.insert(["current.window-ids", window_id, "tabs", index + i],
                      tab_id);
          }

          if (db.has(["transient.tab-ids", tab_id])) {*/
            move_tabs["push"](db.get(["transient.tab-ids", tab_id]));
          //}
        });


        each(indexed(move_tabs), ([i, tab]) => {
          if (chrome_tab !== null && chrome_tab.pinned) {
            tab.pin();
          } else {
            tab.unpin();
          }


          if (chrome_tab === null) {
            tab.move(chrome_window, -1);

          // TODO is this correct ?
          } else if (tab.window === chrome_window &&
                     tab.index < chrome_tab.index) {
            tab.move(chrome_window, chrome_tab.index - 1);

          } else {
            tab.move(chrome_window, chrome_tab.index + i);
          }
        });
      });
    },


    "focus-tab": ({ "tab-id": tab_id }) => {
      // TODO it should re-open the tab if it's unloaded
      const tab = db.get(["transient.tab-ids", tab_id]);

      tab.focus();
    },


    "close-tabs": ({ "tabs": tabs }) => {
      each(tabs, (tab_id) => {
        // TODO it should work even if the tab is unloaded
        const chrome_tab = db.get(["transient.tab-ids", tab_id]);

        //const window_id = db.get(["current.tab-ids", tab_id, "window"]);
        //const tabs = db.get(["current.window-ids", window_id, "tabs"]);



        //const tab = db.get(["current.tab-ids", tab_id]);
        chrome_tab.close();
      });
    }
  };

  ports.on_connect(uuid_port_tab, (port) => {
    port.send({
      "type": "init",
      "windows": serialize_windows(db)
    });

    const x = tab_events.receive((x) => {
      port.send(x);
    });

    port.on_receive((x) => {
      handle_event[x["type"]](x);
    });

    // When the port closes, stop listening for `tab_events`
    // TODO test this
    port.on_disconnect(() => {
      x.stop();
    });
  });


  const delay = (ms) => {
    db.delay("current.windows", ms);
    db.delay("current.window-ids", ms);
    db.delay("current.tab-ids", ms);
  };


  // TODO this can be removed for the final release, it's only for development
  // TODO more checks (e.g. that the indexes are correct)
  const check_integrity = () => {
    const timer = new Timer();

    const windows    = db.get(["current.windows"]);
    const window_ids = db.get(["current.window-ids"]);
    const tab_ids    = db.get(["current.tab-ids"]);

    const seen = new Set();

    let amount = 0;

    each(windows, (id) => {
      assert(window_ids.has(id));
      seen.insert(id);
    });

    each(window_ids, ([id, window]) => {
      assert(window.get("id") === id);
      windows.index_of(id).get();

      const seen = new Set();

      each(window.get("tabs"), (id) => {
        assert(tab_ids.has(id));
        seen.insert(id);
      });
    });

    each(tab_ids, ([id, tab]) => {
      assert(tab.get("id") === id);

      const window = window_ids.get(tab.get("window"));

      window.get("tabs").index_of(id).get();

      ++amount;
    });

    timer.done();
    console["debug"]("windows: checked " + amount + " tabs (" + timer.diff() + "ms)");
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

      db.insert(["transient.tab-ids", tab_id], info);

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
        db.insert(["transient.tab-ids", tab_id], tab);

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

    db.insert(["transient.window-ids", id], info);

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

      db.insert(["transient.window-ids", id], info);

      // TODO is this correct ?
      // TODO what about when reopening a closed window ?
      db.push(["current.windows"], id);

      // TODO inefficient
      const index = db.get(["current.windows"]).index_of(id).get();

      tab_events.send({
        "type": "window-open",
        "window-index": index,
        "window": serialize_window(db, id)
      });
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
      // TODO send events for these ?
      each(tabs, (tab_id) => {
        db.remove(["current.tab-ids", tab_id]);
        // TODO what if the tab isn't unloaded ?
        db.remove(["transient.tab-ids", tab_id]);
      });

      db.remove(["current.window-ids", id]);
      db.remove(["transient.window-ids", id]);

      // TODO can this be implemented more efficiently ?
      const index = db.get(["current.windows"]).index_of(id).get();

      db.remove(["current.windows", index]);

      tab_events.send({
        "type": "window-close",
        "window-id": id,
        "window-index": index
      });
    });
  };

  const tab_open = ({ window, tab, index }) => {
    db.transaction((db) => {
      const window_id = session.window_id(window.id);
      const tab_id = session.tab_id(tab.id);

      make_new_tab(db, window_id, tab_id, tab);

      db.insert(["transient.tab-ids", tab_id], tab);

      const tabs = db.get(["current.window-ids", window_id, "tabs"]);

      const session_index = find_left_index(tabs, window, index);

      db.insert(["current.window-ids", window_id, "tabs", session_index], tab_id);

      tab_events.send({
        "type": "tab-open",
        "window-id": window_id,
        "tab-index": session_index,
        "tab": serialize_tab(db, tab_id)
      });
    });
  };

  const tab_focus = (info) => {
    db.transaction((db) => {
      if (info.old !== null) {
        const tab_id = session.tab_id(info.old.id);

        tab_events.send({
          "type": "tab-unfocus",
          "tab-id": tab_id
        });
      }

      if (info.new !== null) {
        const tab_id = session.tab_id(info.new.id);

        const new_timestamp = timestamp();

        db.assign(["current.tab-ids", tab_id, "time", "focused"], new_timestamp);

        tab_events.send({
          "type": "tab-focus",
          "tab-id": tab_id,
          "tab-time-focused": new_timestamp
        });
      }
    });
  };

  const tab_update = ({ tab }) => {
    db.transaction((db) => {
      const tab_id = session.tab_id(tab.id);

      // TODO a little hacky
      const old_tab = db.get(["current.tab-ids", tab_id]);

      update_tab(db, tab_id, tab);

      // TODO a little hacky
      const new_tab = db.get(["current.tab-ids", tab_id]);

      // TODO is there a better way ?
      if (old_tab !== new_tab) {
        tab_events.send({
          "type": "tab-update",
          "tab-id": tab_id,
          "tab": serialize_tab(db, tab_id)
        });
      }
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


      tab_events.send({
        "type": "tab-move",
        "tab-id": tab_id,
        "window-old-id": old_window_id,
        "window-new-id": new_window_id,
        "tab-old-index": session_old_index,
        "tab-new-index": session_new_index
      });
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
      db.remove(["transient.tab-ids", tab_id]);

      const tabs = db.get(["current.window-ids", window_id, "tabs"]);

      // TODO can this be implemented more efficiently ?
      const index = tabs.index_of(tab_id).get();

      db.remove(["current.window-ids", window_id, "tabs", index]);

      tab_events.send({
        "type": "tab-close",
        "window-id": window_id,
        "tab-id": tab_id,
        "tab-index": index
      });
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


  windows.on_open((info) => {
    session.window_open(info);
    window_open(info);
  });

  windows.on_close((info) => {
    window_close(info);
    // This must be after `window_close`
    session.window_close(info);
  });

  windows.on_focus((info) => {
    window_focus(info);
  });

  tabs.on_open((info) => {
    session.tab_open(info);
    tab_open(info);
  });

  tabs.on_close((info) => {
    tab_close(info);
    // This must be after `tab_close`
    session.tab_close(info);
  });

  tabs.on_focus((info) => {
    tab_focus(info);
  });

  tabs.on_move((info) => {
    session.tab_move(info);
    tab_move(info);
  });

  tabs.on_update((info) => {
    session.tab_update(info);
    tab_update(info);
  });

  tabs.on_replace((info) => {
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
