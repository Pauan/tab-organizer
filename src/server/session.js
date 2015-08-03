import { init as init_db } from "./migrate";
import { map, each, all, zip, indexed } from "../util/iterator";
import { async } from "../util/async";
import { List } from "../util/immutable/list";
import { Record } from "../util/immutable/record";
import { Dict } from "../util/mutable/dict";
import { Timer, timestamp } from "../util/time";
import { assert, fail } from "../util/assert";


const new_id = () => "" + timestamp();


export const init = async(function* () {
  const db = yield init_db;


  const namespace = "session.windows";

  const delay = (ms) => {
    db.delay(namespace, ms);
  };

  db.transaction((db) => {
    db.default([namespace], List());
  });


  const window_ids = new Dict();
  const tab_ids    = new Dict();

  const make_tab = (id, tab) => {
    tab_ids.insert(tab.id, id);

    return Record([
      ["id", id],
      ["url", tab.url]
    ]);
  };

  const make_window = (id, window, tabs) => {
    window_ids.insert(window.id, id);

    return Record([
      ["id", id],
      ["tabs", List(tabs)]
    ]);
  };

  const make_new_tab = (tab) =>
    make_tab(new_id(), tab);

  const make_new_window = (window) => {
    const id = new_id();

    const x = make_window(id, window, map(window.tabs, make_new_tab));

    console["debug"]("session: created new window " +
                     id +
                     " with " +
                     window.tabs.size +
                     " tabs");

    return x;
  };

  const window_id = (id) => window_ids.get(id);
  const tab_id = (id) => tab_ids.get(id);

  const check_window = (db, index, window) => {
    assert(db.get([namespace, index, "id"]) ===
           window_ids.get(window.id));
  };

  const check_tab = (db, window, index, tab) => {
    check_window(db, window.index, window);

    assert(db.get([namespace, window.index, "tabs", index, "id"]) ===
           tab_ids.get(tab.id));
  };

  const lookup = (window, index, ...args) =>
    [namespace, window.index, "tabs", index, ...args];


  const window_open = ({ window, index }) => {
    db.transaction((db) => {
      assert(window.index === index);

      db.insert([namespace, index], make_new_window(window));
    });
  };

  const window_close = ({ window, index }) => {
    db.transaction((db) => {
      assert(window.tabs.size === 0);

      check_window(db, index, window);

      db.remove([namespace, index]);

      window_ids.remove(window.id);
    });
  };

  const tab_open = ({ window, tab, index }) => {
    db.transaction((db) => {
      assert(tab.index === index);
      assert(tab.window === window);

      check_window(db, window.index, window);

      db.insert(lookup(window, index), make_new_tab(tab));
    });
  };

  const tab_close = ({ window, tab, index, window_closing }) => {
    db.transaction((db) => {
      // Delay by 10 seconds, so that when Chrome closes,
      // it doesn't remove the tabs / windows
      if (window_closing) {
        delay(10000);
      }

      check_tab(db, window, index, tab);

      db.remove(lookup(window, index));

      tab_ids.remove(tab.id);
    });
  };

  const tab_update = ({ old, tab }) => {
    db.transaction((db) => {
      if (old.url !== tab.url) {
        check_tab(db, tab.window, tab.index, tab);

        db.update(lookup(tab.window, tab.index, "url"), tab.url);
      }
    });
  };

  const tab_move = ({ tab, old_window, new_window, old_index, new_index }) => {
    db.transaction((db) => {
      check_tab(db, old_window, old_index, tab);
      check_window(db, new_window.index, new_window);

      const session_tab = db.get(lookup(old_window, old_index));
      db.remove(lookup(old_window, old_index));
      db.insert(lookup(new_window, new_index), session_tab);
    });
  };

  const tab_replace = ({ old_id, new_id }) => {
    const x = tab_ids.get(old_id);
    tab_ids.remove(old_id);
    tab_ids.insert(new_id, x);
  };


  const tab_matches = (old_tab, new_tab) =>
    old_tab.get("url") === new_tab.url;

  // If the last tab is a New Tab, then it always matches.
  // This is needed in the situation where the user restarts Chrome,
  // because Chrome will automatically create a New Tab for the user.
  const is_new_tab = (new_tabs, index, new_tab) =>
    // Don't match empty windows
    new_tabs.size >= 2 &&
    index === new_tabs.size - 1 &&
    new_tab.url === "chrome://newtab/";

  const window_matches = (old_window, new_window) => {
    const old_tabs = old_window.get("tabs");
    const new_tabs = new_window.tabs;

    if (old_tabs.size === 0 && new_tabs.size === 0) {
      return true;

    } else if (old_tabs.size >= 1 && new_tabs.size >= 1) {
      // Check that all the old tabs match with the new tabs
      // TODO test this
      return all(zip(old_tabs, indexed(new_tabs)), ([old_tab, [index, new_tab]]) => {
        if (tab_matches(old_tab, new_tab) ||
            is_new_tab(new_tabs, index, new_tab)) {
          return true;

        } else {
          const old_url = old_tab.get("url");
          const new_url = new_tab.url;

          console["debug"]("session: old URL \"" +
                           old_url +
                           "\" does not match with new URL \"" +
                           new_url
                           + "\"");
          return false;
        }
      });

    } else {
      return false;
    }
  };

  const merge_window = (old_window, new_window) => {
    const old_id = old_window.get("id");

    const old_tabs = old_window.get("tabs");
    const new_tabs = new_window.tabs;

    let i_new = 0;

    const x = make_window(old_id, new_window,
      // TODO test this
      map(indexed(new_tabs), ([index, new_tab]) => {
        // Merge with existing tab
        if (old_tabs.has(index)) {
          const old_tab = old_tabs.get(index);

          if (tab_matches(old_tab, new_tab)) {
            return make_tab(old_tab.get("id"), new_tab);

          // Last tab was a New Tab, so we create a new tab
          } else if (is_new_tab(new_tabs, index, new_tab)) {
            ++i_new;
            return make_new_tab(new_tab);

          } else {
            fail();
          }

        // Create new tab
        } else {
          ++i_new;
          return make_new_tab(new_tab);
        }
      }));

    console["debug"]("session: merged " +
                     i_new +
                     " new tabs into window " +
                     old_id);

    return x;
  };

  // TODO test this
  const merge = (old_windows, new_windows) =>
    List(map(indexed(new_windows), ([i, new_window]) => {
      if (old_windows.has(i)) {
        const old_window = old_windows.get(i);

        if (window_matches(old_window, new_window)) {
          return merge_window(old_window, new_window);
        } else {
          return make_new_window(new_window);
        }

      } else {
        return make_new_window(new_window);
      }
    }));

  const init = (new_windows) => {
    db.transaction((db) => {
      const timer_merge = new Timer();

      db.modify([namespace], (old_windows) => merge(old_windows, new_windows));

      timer_merge.done();
      console["debug"]("session: initialized (" +
                       timer_merge.diff() +
                       "ms)");
    });
  };


  return {
    window_id,
    tab_id,

    init,
    window_open,
    window_close,
    tab_open,
    tab_close,
    tab_update,
    tab_move,
    tab_replace
  };
});
