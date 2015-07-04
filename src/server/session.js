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

  db.default("session.windows", List());


  const default_delay = 1000;

  // TODO test this
  const save = (_db, ms, f) => {
    _db.delay("session.windows", ms);
    _db.update("session.windows", f);
  };


  const window_ids = new Dict();
  const tab_ids    = new Dict();

  const make_tab = (id, tab) => {
    tab_ids.add(tab.id, id);

    return Record([
      ["id", id],
      ["url", tab.url]
    ]);
  };

  const make_window = (id, window, tabs) => {
    window_ids.add(window.id, id);

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

  const check_window = (session_window, window) => {
    assert(session_window.get("id") === window_ids.get(window.id));
  };

  const check_tab = (session_tab, tab) => {
    assert(session_tab.get("id") === tab_ids.get(tab.id));
  };

  const update_tabs = (db, ms, window, f) =>
    save(db, ms, (windows) =>
      windows.update(window.index, (session_window) => {
        check_window(session_window, window);
        return session_window.update("tabs", f);
      }));


  const window_open = ({ window, index }) => {
    assert(window.index === index);

    const x = make_new_window(window);

    save(db, default_delay, (windows) => windows.insert(index, x));
  };

  const window_close = ({ window, index }) => {
    assert(window.tabs.size === 0);

    save(db, default_delay, (windows) => {
      check_window(windows.get(index), window);
      return windows.remove(index);
    });

    window_ids.remove(window.id);
  };

  const tab_open = ({ window, tab, index }) => {
    assert(tab.index === index);
    assert(tab.window === window);

    update_tabs(db, default_delay, window, (tabs) => {
      const x = make_new_tab(tab);
      return tabs.insert(index, x);
    });
  };

  const tab_close = ({ window, tab, index, window_closing }) => {
    // Delay by 10 seconds, so that when Chrome closes,
    // it doesn't remove the tabs / windows
    const delay = (window_closing
                    ? 10000
                    : default_delay);

    update_tabs(db, delay, window, (tabs) => {
      check_tab(tabs.get(index), tab);
      return tabs.remove(index);
    });

    tab_ids.remove(tab.id);
  };

  const tab_update = ({ old, tab }) => {
    if (old.url !== tab.url) {
      update_tabs(db, default_delay, tab.window, (tabs) =>
        tabs.update(tab.index, (x) => {
          check_tab(x, tab);
          return x.set("url", tab.url);
        }));
    }
  };

  const tab_move = ({ tab, old_window, new_window, old_index, new_index }) => {
    db.transaction((db) => {
      // TODO a little hacky
      const session_tab = db.get("session.windows")
                            .get(old_window.index)
                            .get("tabs")
                            .get(old_index);

      check_tab(session_tab, tab);

      update_tabs(db, default_delay, old_window, (tabs) => {
        check_tab(tabs.get(old_index), tab);
        return tabs.remove(old_index);
      });

      update_tabs(db, default_delay, new_window, (tabs) =>
        tabs.insert(new_index, session_tab));
    });
  };

  const tab_replace = ({ old_id, new_id }) => {
    const x = tab_ids.get(old_id);
    tab_ids.remove(old_id);
    tab_ids.add(new_id, x);
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
        return tab_matches(old_tab, new_tab) ||
               is_new_tab(new_tabs, index, new_tab);
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
    const timer_merge = new Timer();

    save(db, default_delay, (old_windows) => merge(old_windows, new_windows));

    timer_merge.done();
    console["debug"]("session: initialized (" +
                     timer_merge.diff() +
                     "ms)");
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
