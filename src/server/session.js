import { init as init_chrome } from "../chrome/server";
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
  const { windows } = yield init_chrome;
  const db = yield init_db;

  let saved = db.get("session.windows", List());

  const save = () => {
    db.set("session.windows", saved);
  };

  const delay = () => {
    // TODO maybe this should delay everything, not just "session.windows" ?
    // Delay by 10 seconds, so that when Chrome closes,
    // it doesn't remove the tabs / windows
    db.delay("session.windows", 10000);
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

  const update_tabs = (saved, window, f) =>
    saved.update(window.index, (session_window) => {
      check_window(session_window, window);
      return session_window.update("tabs", f);
    });


  const window_open = ({ window, index }) => {
    assert(window.index === index);

    const x = make_new_window(window);
    saved = saved.insert(index, x);

    save();
  };

  const window_close = ({ window, index }) => {
    assert(window.tabs.size === 0);
    check_window(saved.get(index), window);

    window_ids.remove(window.id);
    saved = saved.remove(index);

    save();
  };

  const tab_open = ({ window, tab, index }) => {
    assert(tab.index === index);
    assert(tab.window === window);

    saved = update_tabs(saved, window, (tabs) => {
      const x = make_new_tab(tab);
      return tabs.insert(index, x);
    });

    save();
  };

  const tab_close = ({ window, tab, index, window_closing }) => {
    if (window_closing) {
      delay();
    }

    saved = update_tabs(saved, window, (tabs) => {
      check_tab(tabs.get(index), tab);

      tab_ids.remove(tab.id);

      return tabs.remove(index);
    });

    save();
  };

  const tab_update = ({ old, tab }) => {
    if (old.url !== tab.url) {
      saved = update_tabs(saved, tab.window, (tabs) =>
        tabs.update(tab.index, (x) => {
          check_tab(x, tab);
          return x.set("url", tab.url);
        }));

      save();
    }
  };

  const tab_move = ({ tab, old_window, new_window, old_index, new_index }) => {
    const session_window = saved.get(old_window.index);
    const session_tab    = session_window.get("tabs").get(old_index);

    check_window(session_window, old_window);
    check_tab(session_tab, tab);

    saved = update_tabs(saved, old_window, (tabs) => {
      check_tab(tabs.get(old_index), tab);
      return tabs.remove(old_index);
    });

    saved = update_tabs(saved, new_window, (tabs) =>
              tabs.insert(new_index, session_tab));

    save();
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

  const timer_merge = new Timer();

  saved = merge(saved, windows.get());
  save();

  timer_merge.done();
  console["debug"]("session: initialized (" +
                   timer_merge.diff() +
                   "ms)");


  return {
    window_id,
    tab_id,

    window_open,
    window_close,
    tab_open,
    tab_close,
    tab_update,
    tab_move,
    tab_replace
  };
});
