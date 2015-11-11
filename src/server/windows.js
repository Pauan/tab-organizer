import * as event from "../util/event";
import * as list from "../util/list";
import * as record from "../util/record";
import * as running from "../util/running";
import * as set from "../util/set"; // TODO this is only needed for development
import * as timer from "../util/timer";
import * as async from "../util/async";
import * as maybe from "../util/maybe";
import * as console from "../util/console";
import { uuid_port_tab } from "../common/uuid";
import { init as init_chrome } from "../chrome/server";
import { init as init_session } from "./session";
import { init as init_db } from "./migrate";
import { timestamp } from "../util/time";
import { assert, crash } from "../util/assert";


export const init = async.all([init_db,
                               init_chrome,
                               init_session],
                              (db,
                               { windows, tabs, ports },
                               session) => {

  db.include("current.windows", list.make());
  db.include("current.window-ids", record.make());
  db.include("current.tab-ids", record.make());
  db.include("current.tag-ids", record.make());

  const transient_window_ids = record.make();
  const transient_tab_ids = record.make();

  // TODO just use `tab_events` instead ?
  const on_tab_open = event.make();
  const on_tab_close = event.make();

  const tab_events = event.make();

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


  const serialize_transient = (transient) =>
    record.make({
      "focused": transient.focused
    });

  const serialize_transients = () => {
    const out = record.make();

    record.each(transient_tab_ids, (key, value) => {
      record.insert(out, key, serialize_transient(value));
    });

    return out;
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

      // TODO replace with `keep_map` ?
      list.each(_tabs, (tab_id, i) => {
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


      list.each(move_tabs, (tab, i) => {
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
      db.transaction(() => {
        const _tabs = record.get(x, "tabs");

        list.each(_tabs, (tab_id) => {
          if (record.has(transient_tab_ids, tab_id)) {
            // TODO it should work even if the tab is unloaded
            const chrome_tab = record.get(transient_tab_ids, tab_id);

            //const window_id = db.get(["current.tab-ids", tab_id, "window"]);
            //const tabs = db.get(["current.window-ids", window_id, "tabs"]);

            //const tab = db.get(["current.tab-ids", tab_id]);
            tabs.close(chrome_tab);

          } else {
            close_tab(tab_id);
          }
        });
      });
    }
  });

  ports.on_open(uuid_port_tab, (port) => {
    ports.send(port, record.make({
      "type": "init",
      "current.windows": db.get("current.windows"),
      "current.window-ids": db.get("current.window-ids"),
      "current.tab-ids": db.get("current.tab-ids"),
      "current.tag-ids": db.get("current.tag-ids"),
      "transient.tab-ids": serialize_transients()
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


  // TODO this can be removed for the final release, it's only for development
  // TODO more checks (e.g. that the indexes are correct)
  // TODO rather than putting this here, this should instead be in `migrate.js`
  window["fix_integrity"] = () => {
    const duration = timer.make();

    const windows_seen     = set.make();
    const window_tabs_seen = set.make();

    let amount = 0;

    // TODO more efficient version of this ?
    // TODO move into another module ?
    const keep = (a, f) => {
      const to_remove = list.make();

      list.each(a, (x) => {
        if (!f(x)) {
          list.push(to_remove, x);
        }
      });

      list.each(to_remove, (x) => {
        list.remove(a, list.index_of(a, x));
      });
    };

    db.transaction(() => {
      db.write("current.windows", (windows) => {
        db.write("current.window-ids", (window_ids) => {
          db.write("current.tab-ids", (tab_ids) => {
            db.write("current.tag-ids", (tag_ids) => {
              record.each(tab_ids, (id, tab) => {
                assert(record.get(tab, "id") === id);

                const window = record.get(window_ids, record.get(tab, "window"));

                if (!list.contains(record.get(window, "tabs"), id)) {
                  // TODO is it safe to do this while it's iterating ?
                  record.exclude(tab_ids, id);
                }

                record.each(record.get(tab, "tags"), (tag_id) => {
                  const tag = record.get(tag_ids, tag_id);

                  if (!list.contains(record.get(tag, "tabs"), id)) {
                    // TODO is it safe to do this while it's iterating ?
                    record.exclude(tab_ids, id);
                  }
                });

                ++amount;
              });


              record.each(window_ids, (id, window) => {
                assert(record.get(window, "id") === id);

                if (!list.contains(windows, id)) {
                  // TODO is it safe to do this while it's iterating ?
                  record.exclude(window_ids, id);
                }

                keep(record.get(window, "tabs"), (id) => {
                  set.insert(window_tabs_seen, id);
                  return record.has(tab_ids, id);
                });
              });


              record.each(tag_ids, (id, tag) => {
                assert(record.get(tag, "id") === id);

                const seen = set.make();

                keep(record.get(tag, "tabs"), (id) => {
                  set.insert(seen, id);
                  return record.has(tab_ids, id);
                });
              });


              keep(windows, (id) => {
                set.insert(windows_seen, id);
                return record.has(window_ids, id);
              });
            });
          });
        });
      });
    });


    timer.done(duration);
    console.info("windows: fixed " + amount + " tabs (" + timer.diff(duration) + "ms)");
  };

  // TODO this can be removed for the final release, it's only for development
  // TODO more checks (e.g. that the indexes are correct)
  // TODO rather than putting this here, this should instead be in `migrate.js`
  const check_integrity = () => {
    const duration = timer.make();

    const windows    = db.get("current.windows");
    const window_ids = db.get("current.window-ids");
    const tab_ids    = db.get("current.tab-ids");
    const tag_ids    = db.get("current.tag-ids");


    const windows_seen = set.make();

    list.each(windows, (id) => {
      assert(record.has(window_ids, id));
      set.insert(windows_seen, id);
    });


    const window_tabs_seen = set.make();

    record.each(window_ids, (id, window) => {
      assert(record.get(window, "id") === id);
      assert(set.has(windows_seen, id));

      list.each(record.get(window, "tabs"), (id) => {
        assert(record.has(tab_ids, id));
        set.insert(window_tabs_seen, id);
      });
    });


    const tag_tabs_seen = set.make();

    record.each(tag_ids, (id, tag) => {
      assert(record.get(tag, "id") === id);

      const seen = set.make();

      list.each(record.get(tag, "tabs"), (id) => {
        assert(record.has(tab_ids, id));
        set.insert(seen, id);
        set.include(tag_tabs_seen, id);
      });
    });


    let amount = 0;

    record.each(tab_ids, (id, tab) => {
      assert(record.get(tab, "id") === id);
      assert(set.has(window_tabs_seen, id));
      assert(set.has(tag_tabs_seen, id));

      const window = record.get(window_ids, record.get(tab, "window"));
      list.index_of(record.get(window, "tabs"), id);

      record.each(record.get(tab, "tags"), (tag_id) => {
        const tag = record.get(tag_ids, tag_id);
        list.index_of(record.get(tag, "tabs"), id);
      });

      ++amount;
    });


    timer.done(duration);
    console.info("windows: checked " + amount + " tabs (" + timer.diff(duration) + "ms)");
  };


  const should_update = (tab, info) =>
    record.get(tab, "url")     !== info.url     ||
    record.get(tab, "title")   !== info.title   ||
    record.get(tab, "favicon") !== info.favicon ||
    record.get(tab, "pinned")  !== info.pinned;

  const update_time = (x, name) => {
    const time = timestamp();
    record.assign(record.get(x, "time"), name, time);
    return time;
  };

  const update_tab = (tab_id, info, events) => {
    db.write("current.tab-ids", (tab_ids) => {
      const tab = record.get(tab_ids, tab_id);

      if (should_update(tab, info)) {
        record.update(tab, "url", info.url);
        record.update(tab, "title", info.title);
        record.update(tab, "favicon", info.favicon);
        record.update(tab, "pinned", info.pinned);
        const time = update_time(tab, "updated");

        if (events) {
          event.send(tab_events, record.make({
            "type": "tab-update",
            "tab-id": tab_id,
            "tab-url": info.url,
            "tab-title": info.title,
            "tab-favicon": info.favicon,
            "tab-pinned": info.pinned,
            "tab-time-updated": time
          }));
        }
      }
    });
  };

  const close_tab = (tab_id) => {
    // TODO test this
    remove_all_tags_from_tab(tab_id, true);

    db.write("current.tab-ids", (tab_ids) => {
      const tab = record.get(tab_ids, tab_id);

      const window_id = record.get(tab, "window");

      const transient = record.get_maybe(transient_tab_ids, tab_id);

      record.remove(tab_ids, tab_id);
      record.exclude(transient_tab_ids, tab_id);

      db.write("current.window-ids", (window_ids) => {
        const tabs = record.get(record.get(window_ids, window_id), "tabs");

        // TODO can this be implemented more efficiently ?
        const index = list.index_of(tabs, tab_id);

        // TODO what if the window doesn't have anymore tabs in it ?
        list.remove(tabs, index);

        event.send(tab_events, record.make({
          "type": "tab-close",
          "window-id": window_id,
          "tab-id": tab_id,
          "tab-index": index
        }));
      });

      // TODO should this include the tags ?
      event.send(on_tab_close, { tab, transient });
    });
  };


  const add_tag_to_tab = (tab_id, tag_id, events) => {
    db.write("current.tab-ids", (tab_ids) => {
      const tab = record.get(tab_ids, tab_id);

      const time = timestamp();

      record.insert(record.get(tab, "tags"), tag_id, time);


      db.write("current.tag-ids", (tag_ids) => {
        // TODO test this
        const tag = record.set_default(tag_ids, tag_id, () => {
          const tag = record.make({
            "id": tag_id,
            "tabs": list.make()
          });

          if (events) {
            event.send(tab_events, record.make({
              "type": "tag-create",
              "tag": tag
            }));
          }

          return tag;
        });


        // TODO assert that the tab id isn't already in the tag ?
        list.push(record.get(tag, "tabs"), tab_id);

        if (events) {
          event.send(tab_events, record.make({
            "type": "tag-insert-tab",
            "tag-id": tag_id,
            "tab-id": tab_id,
            "tag-time": time
          }));
        }
      });
    });
  };

  const remove_tag_from_tab = (tab_id, tag_id, events) => {
    db.write("current.tab-ids", (tab_ids) => {
      const tab = record.get(tab_ids, tab_id);

      record.remove(record.get(tab, "tags"), tag_id);
    });

    db.write("current.tag-ids", (tag_ids) => {
      const tag  = record.get(tag_ids, tag_id);
      const tabs = record.get(tag, "tabs");

      const index = list.index_of(tabs, tab_id);

      // TODO test this
      list.remove(tabs, index);

      if (events) {
        event.send(tab_events, record.make({
          "type": "tag-remove-tab",
          "tag-id": tag_id,
          "tab-id": tab_id,
          "tab-index": index
        }));
      }

      // TODO test this
      if (list.size(tabs) === 0) {
        record.remove(tag_ids, tag_id);

        if (events) {
          event.send(tab_events, record.make({
            "type": "tag-remove",
            "tag-id": tag_id
          }));
        }
      }
    });
  };

  // TODO faster implementation of this ?
  const remove_all_tags_from_tab = (tab_id, events) => {
    const tab = record.get(db.get("current.tab-ids"), tab_id);

    record.each(record.get(tab, "tags"), (tag_id) => {
      // TODO this removes the property while it's looping, is that okay ?
      remove_tag_from_tab(tab_id, tag_id, events);
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

    return tab;
  };

  const update_window = (window_id, info) => {
    const tab_ids = db.get("current.tab-ids");

    list.each(info.tabs, (info) => {
      const tab_id = session.tab_id(info.id);

      record.insert(transient_tab_ids, tab_id, info);

      if (record.has(tab_ids, tab_id)) {
        // TODO assert that the index is correct ?
        update_tab(tab_id, info, false);

      } else {
        make_new_tab(window_id, tab_id, info);
        // TODO is this correct ?
        add_tag_to_tab(tab_id, "", false);

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

      "tabs": list.map(info.tabs, (tab) => {
        const tab_id = session.tab_id(tab.id);

        make_new_tab(window_id, tab_id, tab);
        // TODO is this correct ?
        add_tag_to_tab(tab_id, "", false);

        record.insert(transient_tab_ids, tab_id, tab);

        return tab_id;
      }),

      "time": record.make({
        "created": timestamp()
        //"focused": null,
        //"unloaded": null
      })
    });

    db.write("current.window-ids", (window_ids) => {
      record.insert(window_ids, window_id, window);
    });

    return window;
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

    const window = make_new_window(id, info);

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
        "window": window
      }));
    });
  };

  // TODO send event ?
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
      list.each(tabs, (tab_id) => {
        // TODO is this correct ?
        remove_all_tags_from_tab(tab_id);

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

    const tab = make_new_tab(window_id, tab_id, transient);

    db.write("current.window-ids", (window_ids) => {
      const tabs = record.get(record.get(window_ids, window_id), "tabs");

      const session_index = find_left_index(tabs, window, index);

      list.insert(tabs, session_index, tab_id);

      event.send(tab_events, record.make({
        "type": "tab-open",
        "window-id": window_id,
        "tab-index": session_index,
        "tab": tab,
        "tab-transient": serialize_transient(transient)
      }));

      add_tag_to_tab(tab_id, "", true);
    });

    event.send(on_tab_open, { tab, transient: maybe.some(transient) });
  };

  // TODO send a single tab-focus event, and get rid of tab-unfocus event ?
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

      db.write("current.tab-ids", (tab_ids) => {
        const tab = record.get(tab_ids, tab_id);
        const new_timestamp = update_time(tab, "focused");

        event.send(tab_events, record.make({
          "type": "tab-focus",
          "tab-id": tab_id,
          "tab-time-focused": new_timestamp
        }));
      });
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


    db.write("current.window-ids", (window_ids) => {
      const old_window = record.get(window_ids, old_window_id);
      const new_window = record.get(window_ids, new_window_id);

      const old_tabs   = record.get(old_window, "tabs");
      const new_tabs   = record.get(new_window, "tabs");

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
            crash();
          }

        } else {
          // TODO is this correct ?
          return find_left_index(new_tabs, new_window, new_index);
        }
      })();

      list.insert(new_tabs, session_new_index, tab_id);


      db.write("current.tab-ids", (tab_ids) => {
        const tab = record.get(tab_ids, tab_id);

        record.modify(tab, "window", (window_id) => {
          assert(window_id === old_window_id);
          return new_window_id;
        });

        // TODO what if it wasn't moved ?
        const time = update_time(tab, "moved");

        event.send(tab_events, record.make({
          "type": "tab-move",
          "tab-id": tab_id,
          "window-old-id": old_window_id,
          "window-new-id": new_window_id,
          "tab-old-index": session_old_index,
          "tab-new-index": session_new_index,
          "tab-time-moved": time
        }));
      });
    });
  };


  db.transaction(() => {
    // This must go before `window_init`
    session.init(windows.get_all());

    check_integrity();

    // TODO time this
    list.each(windows.get_all(), (info) => {
      window_init(info);
    });

    check_integrity();
  });


  event.on_receive(windows.on_open, (info) => {
    db.transaction(() => {
      session.window_open(info);
      window_open(info);
    });
  });

  event.on_receive(windows.on_close, (info) => {
    db.transaction(() => {
      window_close(info);
      // This must be after `window_close`
      session.window_close(info);
    });
  });

  event.on_receive(windows.on_focus, (info) => {
    db.transaction(() => {
      window_focus(info);
    });
  });

  event.on_receive(tabs.on_open, (info) => {
    db.transaction(() => {
      session.tab_open(info);
      tab_open(info);
    });
  });

  event.on_receive(tabs.on_close, (info) => {
    db.transaction(() => {
      // Delay by 10 seconds, so that when Chrome closes,
      // it doesn't remove the tabs / windows
      // TODO maybe do this automatically in chrome/server/windows.js or something ?
      if (info.window_closing) {
        db.delay("current.windows", 10000);
        db.delay("current.window-ids", 10000);
        db.delay("current.tab-ids", 10000);
        db.delay("current.tag-ids", 10000);
      }

      const tab_id = session.tab_id(info.tab.id);

      close_tab(tab_id);

      // This must be after `session.tab_id`
      session.tab_close(info);
    });
  });

  event.on_receive(tabs.on_focus, (info) => {
    db.transaction(() => {
      tab_focus(info);
    });
  });

  event.on_receive(tabs.on_move, (info) => {
    db.transaction(() => {
      session.tab_move(info);
      tab_move(info);
    });
  });

  event.on_receive(tabs.on_update, (info) => {
    db.transaction(() => {
      session.tab_update(info);
      tab_update(info);
    });
  });

  event.on_receive(tabs.on_replace, (info) => {
    db.transaction(() => {
      session.tab_replace(info);
    });
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
    const out = list.make();

    record.each(db.get("current.tab-ids"), (id, tab) => {
      const transient = record.get_maybe(transient_tab_ids, id);

      list.push(out, { tab, transient });
    });

    return out;
  };


  return async.done({ get_all_tabs, on_tab_open, on_tab_close });
});
