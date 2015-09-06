import * as event from "../util/event";
import * as list from "../util/list";
import * as record from "../util/record";
import * as running from "../util/running";
import * as set from "../util/set"; // TODO this is only needed for development
import * as timer from "../util/timer";
import { uuid_port_tab } from "../common/uuid";
import { init as init_chrome } from "../chrome/server";
import { init as init_session } from "./session";
import { init as init_db } from "./migrate";
import { each, entries, map, indexed } from "../util/iterator";
import { timestamp } from "../util/time";
import { assert, fail } from "../util/assert";
import { async } from "../util/async";


export const init = async([init_db,
                           init_chrome,
                           init_session],
                          (db,
                           { windows, tabs, ports },
                           session) => {

  db.include("current.windows", list.make());
  db.include("current.window-ids", record.make());
  db.include("current.tab-ids", record.make());

  const transient_window_ids = record.make();
  const transient_tab_ids = record.make();

  const on_tab_open = event.make();
  const on_tab_close = event.make();
  const tab_events = event.make();

  const serialize_tab = (id) => {
    const tab = record.get(db.get("current.tab-ids"), id);

    return record.make({
      "id": record.get(tab, "id"),
      "time": record.get(tab, "time"),
      "url": record.get(tab, "url"),
      "title": record.get(tab, "title"),
      "favicon": record.get(tab, "favicon"),
      "pinned": record.get(tab, "pinned"),
      "focused": record.has(transient_tab_ids, id) &&
                 record.get(transient_tab_ids, id).focused,
      "unloaded": !record.has(transient_tab_ids, id)
    });
  };

  const serialize_window = (id) => {
    const window = record.get(db.get("current.window-ids"), id);

    return record.make({
      "id": record.get(window, "id"),
      "name": record.get(window, "name"),
      "tabs": list.make(map(record.get(window, "tabs"), serialize_tab))
    });
  };

  const serialize_windows = () => {
    const windows = db.get("current.windows");

    return list.make(map(windows, serialize_window));
  };

  // TODO test this
  const find_chrome_tab = (window_id, index) => {
    const window = record.get(db.get("current.window-ids"), window_id);
    const tabs   = record.get(window, "tabs");

    const size = list.size(tabs);

    // TODO test this
    while (index < size) {
      const tab_id = list.get(tabs, index);

      if (record.has(transient_tab_ids, tab_id)) {
        return record.get(transient_tab_ids, tab_id);
      }

      ++index;
    }

    return null;
  };

  const handle_event = record.make({
    // TODO send out `tab_events` ?
    "move-tabs": (x) => {
      const window_id = record.get(x, "window");
      const _tabs = record.get(x, "tabs");
      const index = record.get(x, "index");

      // TODO if the Chrome window doesn't exist, we should create a new one
      const chrome_window = record.get(transient_window_ids, window_id);
      const chrome_tab = find_chrome_tab(window_id, index);

      if (chrome_tab !== null) {
        assert(chrome_tab.window === chrome_window);
      }


      const move_tabs = list.make();

      each(indexed(_tabs), ([i, tab_id]) => {
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
          list.push(move_tabs, record.get(transient_tab_ids, tab_id));
        //}
      });


      each(indexed(move_tabs), ([i, tab]) => {
        if (chrome_tab !== null && chrome_tab.pinned) {
          tabs.pin(tab);
        } else {
          tabs.unpin(tab);
        }


        if (chrome_tab === null) {
          tabs.move(tab, chrome_window, -1);

        // TODO is this correct ?
        } else if (tab.window === chrome_window &&
                   tab.index < chrome_tab.index) {
          tabs.move(tab, chrome_window, chrome_tab.index - 1);

        } else {
          tabs.move(tab, chrome_window, chrome_tab.index + i);
        }
      });
    },


    "focus-tab": (x) => {
      const tab_id = record.get(x, "tab-id");
      // TODO it should re-open the tab if it's unloaded
      const tab = record.get(transient_tab_ids, tab_id);

      tabs.focus(tab);
    },


    "close-tabs": (x) => {
      const _tabs = record.get(x, "tabs");

      each(_tabs, (tab_id) => {
        // TODO it should work even if the tab is unloaded
        const chrome_tab = record.get(transient_tab_ids, tab_id);

        //const window_id = db.get(["current.tab-ids", tab_id, "window"]);
        //const tabs = db.get(["current.window-ids", window_id, "tabs"]);



        //const tab = db.get(["current.tab-ids", tab_id]);
        tabs.close(chrome_tab);
      });
    }
  });

  ports.on_open(uuid_port_tab, (port) => {
    ports.send(port, record.make({
      "type": "init",
      "windows": serialize_windows()
    }));

    const x = event.on_receive(tab_events, (x) => {
      ports.send(port, x);
    });

    ports.on_receive(port, (x) => {
      record.get(handle_event, record.get(x, "type"))(x);
    });

    // When the port closes, stop listening for `tab_events`
    // TODO test this
    ports.on_close(port, () => {
      running.stop(x);
    });
  });


  const delay = (ms) => {
    db.delay("current.windows", ms);
    db.delay("current.window-ids", ms);
    db.delay("current.tab-ids", ms);
  };


  // TODO this can be removed for the final release, it's only for development
  // TODO more checks (e.g. that the indexes are correct)
  // TODO rather than putting this here, this should instead be in `migrate.js`
  const check_integrity = () => {
    const duration = timer.make();

    const windows    = db.get("current.windows");
    const window_ids = db.get("current.window-ids");
    const tab_ids    = db.get("current.tab-ids");

    const seen = set.make();

    let amount = 0;

    each(windows, (id) => {
      assert(record.has(window_ids, id));
      set.insert(seen, id);
    });

    each(entries(window_ids), ([id, window]) => {
      assert(record.get(window, "id") === id);
      list.index_of(windows, id);

      const seen = set.make();

      each(record.get(window, "tabs"), (id) => {
        assert(record.get(tab_ids, id));
        set.insert(seen, id);
      });
    });

    each(entries(tab_ids), ([id, tab]) => {
      assert(record.get(tab, "id") === id);

      const window = record.get(window_ids, record.get(tab, "window"));

      list.index_of(record.get(window, "tabs"), id);

      ++amount;
    });

    timer.done(duration);
    console["debug"]("windows: checked " + amount + " tabs (" + timer.diff(duration) + "ms)");
  };


  const should_update = (tab, info) =>
    record.get(tab, "url")     !== info.url     ||
    record.get(tab, "title")   !== info.title   ||
    record.get(tab, "favicon") !== info.favicon ||
    record.get(tab, "pinned")  !== info.pinned;

  const update_time = (x, name) => {
    record.assign(record.get(x, "time"), name, timestamp());
  };

  const update_tab = (tab_id, info, events) => {
    db.write("current.tab-ids", (tab_ids) => {
      const tab = record.get(tab_ids, tab_id);

      if (should_update(tab, info)) {
        record.update(tab, "url", info.url);
        record.update(tab, "title", info.title);
        record.update(tab, "favicon", info.favicon);
        record.update(tab, "pinned", info.pinned);
        update_time(tab, "updated");

        if (events) {
          event.send(tab_events, record.make({
            "type": "tab-update",
            "tab-id": tab_id,
            "tab": serialize_tab(tab_id)
          }));
        }
      }
    });
  };

  const make_new_tab = (window_id, tab_id, info) => {
    const tab = record.make({
      "id": tab_id,
      "window": window_id,
      "url": info.url,
      "title": info.title,
      "favicon": info.favicon,
      "pinned": info.pinned,

      "time": record.make({
        "created": timestamp()
        //"updated": null,
        //"unloaded": null,
        //"focused": null,
        //"moved-in-window": null,
        //"moved-to-window": null
      }),

      "tags": record.make()
    });

    db.write("current.tab-ids", (tab_ids) => {
      record.insert(tab_ids, tab_id, tab);
    });
  };

  const update_window = (window_id, info) => {
    const tab_ids = db.get("current.tab-ids");

    each(info.tabs, (info) => {
      const tab_id = session.tab_id(info.id);

      record.insert(transient_tab_ids, tab_id, info);

      if (record.has(tab_ids, tab_id)) {
        // TODO assert that the index is correct ?
        update_tab(tab_id, info, false);

      } else {
        make_new_tab(window_id, tab_id, info);

        db.write("current.window-ids", (window_ids) => {
          const tabs = record.get(record.get(window_ids, window_id), "tabs");

          // TODO is this correct ?
          list.push(tabs, tab_id);
        });
      }
    });
  };

  const make_new_window = (window_id, info) => {
    const window = record.make({
      "id": window_id,
      "name": null,

      "tabs": list.make(map(info.tabs, (tab) => {
        const tab_id = session.tab_id(tab.id);

        make_new_tab(window_id, tab_id, tab);

        record.insert(transient_tab_ids, tab_id, tab);

        return tab_id;
      })),

      "time": record.make({
        "created": timestamp()
        //"focused": null,
        //"unloaded": null
      })
    });

    db.write("current.window-ids", (window_ids) => {
      record.insert(window_ids, window_id, window);
    });
  };

  const find_right_index = (tabs, window, index) => {
    // TODO test this
    const prev = list.get(window.tabs, index - 1);
    const prev_id = session.tab_id(prev.id);
    // TODO can this be implemented more efficiently ?
    const prev_index = list.index_of(tabs, prev_id);
    return prev_index + 1;
  };

  const find_left_index = (tabs, window, index) => {
    // TODO test this
    if (list.has(window.tabs, index + 1)) {
      const next = list.get(window.tabs, index + 1);
      const next_id = session.tab_id(next.id);
      // TODO can this be implemented more efficiently ?
      return list.index_of(tabs, next_id);

    } else {
      // TODO is this correct ?
      return list.size(tabs);
    }
  };


  const window_init = (info) => {
    const id = session.window_id(info.id);

    record.insert(transient_window_ids, id, info);

    // TODO this is a little inefficient
    const window_ids = db.get("current.window-ids");

    // TODO is this correct ?
    if (record.has(window_ids, id)) {
      // TODO assert that the index is correct ?
      update_window(id, info);

    } else {
      make_new_window(id, info);

      db.write("current.windows", (windows) => {
        // TODO is this correct ?
        // TODO what about when reopening a closed window ?
        list.push(windows, id);
      });
    }
  };

  const window_open = ({ window: info }) => {
    const id = session.window_id(info.id);

    make_new_window(id, info);

    record.insert(transient_window_ids, id, info);

    db.write("current.windows", (windows) => {
      // TODO is this correct ?
      const index = list.size(windows);

      // TODO is this correct ?
      // TODO what about when reopening a closed window ?
      list.push(windows, id);

      event.send(tab_events, record.make({
        "type": "window-open",
        "window-index": index,
        "window": serialize_window(id)
      }));
    });
  };

  const window_focus = (info) => {
    if (info.new !== null) {
      const id = session.window_id(info.new.id);

      db.write("current.window-ids", (window_ids) => {
        const window = record.get(window_ids, id);
        update_time(window, "focused");
      });
    }
  };

  const window_close = ({ window: info }) => {
    const id = session.window_id(info.id);

    db.write("current.window-ids", (window_ids) => {
      const tabs = record.get(record.get(window_ids, id), "tabs");

      // Removes all the unloaded tabs
      // TODO test this
      // TODO send events for these ?
      each(tabs, (tab_id) => {
        db.write("current.tab-ids", (tab_ids) => {
          record.remove(tab_ids, tab_id);
          // TODO what if the tab isn't unloaded ?
          record.remove(transient_tab_ids, tab_id);
        });
      });

      record.remove(window_ids, id);
      record.remove(transient_window_ids, id);
    });

    db.write("current.windows", (windows) => {
      // TODO can this be implemented more efficiently ?
      const index = list.index_of(windows, id);

      list.remove(windows, index);

      event.send(tab_events, record.make({
        "type": "window-close",
        "window-id": id,
        "window-index": index
      }));
    });
  };

  const tab_open = ({ window, tab: transient, index }) => {
    const window_id = session.window_id(window.id);
    const tab_id = session.tab_id(transient.id);

    record.insert(transient_tab_ids, tab_id, transient);

    make_new_tab(window_id, tab_id, transient);

    // TODO a tiny bit inefficient ?
    const tab = record.get(db.get("current.tab-ids"), tab_id);

    db.write("current.window-ids", (window_ids) => {
      const tabs = record.get(record.get(window_ids, window_id), "tabs");

      const session_index = find_left_index(tabs, window, index);

      list.insert(tabs, session_index, tab_id);

      event.send(tab_events, record.make({
        "type": "tab-open",
        "window-id": window_id,
        "tab-index": session_index,
        "tab": serialize_tab(tab_id)
      }));
    });

    event.send(on_tab_open, { tab, transient });
  };

  const tab_focus = (info) => {
    if (info.old !== null) {
      const tab_id = session.tab_id(info.old.id);

      event.send(tab_events, record.make({
        "type": "tab-unfocus",
        "tab-id": tab_id
      }));
    }

    if (info.new !== null) {
      const tab_id = session.tab_id(info.new.id);

      const new_timestamp = timestamp();

      db.write("current.tab-ids", (tab_ids) => {
        // TODO code duplication with update_time
        const time = record.get(record.get(tab_ids, tab_id), "time");
        record.assign(time, "focused", new_timestamp);
      });

      event.send(tab_events, record.make({
        "type": "tab-focus",
        "tab-id": tab_id,
        "tab-time-focused": new_timestamp
      }));
    }
  };

  const tab_update = ({ tab }) => {
    const tab_id = session.tab_id(tab.id);

    update_tab(tab_id, tab, true);
  };

  // TODO test this
  const tab_move = ({ tab, old_window, new_window, old_index, new_index }) => {
    const tab_id = session.tab_id(tab.id);

    const old_window_id = session.window_id(old_window.id);
    const new_window_id = session.window_id(new_window.id);


    db.write("current.tab-ids", (tab_ids) => {
      const tab = record.get(tab_ids, tab_id);

      record.update(tab, "window", new_window_id);

      // TODO what if it wasn't moved ?
      update_time(tab, "moved");
    });


    db.write("current.window-ids", (window_ids) => {
      const old_window = record.get(window_ids, old_window_id);
      const old_tabs = record.get(old_window, "tabs");

      const new_window = record.get(window_ids, new_window_id);
      const new_tabs = record.get(new_window, "tabs");

      const session_old_index = list.index_of(old_tabs, tab_id);

      list.remove(old_tabs, session_old_index);


      // TODO a little bit inefficient
      // This has to come after removing the tab from old_tabs, in case
      // old_window and new_window are the same
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

      list.insert(new_tabs, session_new_index, tab_id);


      // TODO send along the new "moved" timestamp as well ?
      event.send(tab_events, record.make({
        "type": "tab-move",
        "tab-id": tab_id,
        "window-old-id": old_window_id,
        "window-new-id": new_window_id,
        "tab-old-index": session_old_index,
        "tab-new-index": session_new_index
      }));
    });
  };

  const tab_close = (info) => {
    // Delay by 10 seconds, so that when Chrome closes,
    // it doesn't remove the tabs / windows
    // TODO is this place correct ?
    if (info.window_closing) {
      delay(10000);
    }

    const window_id = session.window_id(info.window.id);
    const tab_id = session.tab_id(info.tab.id);

    db.write("current.tab-ids", (tab_ids) => {
      db.write("current.window-ids", (window_ids) => {
        const tab = record.get(tab_ids, tab_id);
        const transient = record.get(transient_tab_ids, tab_id);

        record.remove(tab_ids, tab_id);
        record.remove(transient_tab_ids, tab_id);

        const tabs = record.get(record.get(window_ids, window_id), "tabs");

        // TODO can this be implemented more efficiently ?
        const index = list.index_of(tabs, tab_id);

        list.remove(tabs, index);

        event.send(tab_events, record.make({
          "type": "tab-close",
          "window-id": window_id,
          "tab-id": tab_id,
          "tab-index": index
        }));

        event.send(on_tab_close, { tab, transient });
      });
    });
  };


  // This must go before `window_init`
  session.init(windows.get_all());


  check_integrity();

  // TODO time this
  each(windows.get_all(), (info) => {
    window_init(info);
  });

  check_integrity();


  event.on_receive(windows.on_open, (info) => {
    session.window_open(info);
    window_open(info);
  });

  event.on_receive(windows.on_close, (info) => {
    window_close(info);
    // This must be after `window_close`
    session.window_close(info);
  });

  event.on_receive(windows.on_focus, (info) => {
    window_focus(info);
  });

  event.on_receive(tabs.on_open, (info) => {
    session.tab_open(info);
    tab_open(info);
  });

  event.on_receive(tabs.on_close, (info) => {
    tab_close(info);
    // This must be after `tab_close`
    session.tab_close(info);
  });

  event.on_receive(tabs.on_focus, (info) => {
    tab_focus(info);
  });

  event.on_receive(tabs.on_move, (info) => {
    session.tab_move(info);
    tab_move(info);
  });

  event.on_receive(tabs.on_update, (info) => {
    session.tab_update(info);
    tab_update(info);
  });

  event.on_receive(tabs.on_replace, (info) => {
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

  const get_all_tabs = () => {
    return map(entries(db.get("current.tab-ids")), ([id, tab]) => {
      const transient = (record.has(transient_tab_ids, id)
                          ? record.get(transient_tab_ids, id)
                          : null);
      return { tab, transient };
    });
  };

  return { get_all_tabs, on_tab_open, on_tab_close };
});
