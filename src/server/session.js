import * as record from "../util/record";
import * as timer from "../util/timer";
import * as list from "../util/list";
import * as async from "../util/async";
import { init as init_db } from "./migrate";
import { timestamp } from "../util/time";
import { assert, fail } from "../util/assert";


const new_id = () => "" + timestamp();


export const init = async.all([init_db], (db) => {
  const namespace = "session.windows";

  const delay = (ms) => {
    db.delay(namespace, ms);
  };

  db.include(namespace, list.make());


  const window_ids = record.make();
  const tab_ids    = record.make();

  const make_tab = (id, tab) => {
    record.insert(tab_ids, tab.id, id);

    return record.make({
      "id": id,
      "url": tab.url
    });
  };

  const make_window = (id, window, tabs) => {
    record.insert(window_ids, window.id, id);

    return record.make({
      "id": id,
      "tabs": tabs
    });
  };

  const make_new_tab = (tab) =>
    make_tab(new_id(), tab);

  const make_new_window = (window) => {
    const id = new_id();

    const x = make_window(id, window, list.map(window.tabs, make_new_tab));

    console["debug"]("session: created new window " +
                     id +
                     " with " +
                     list.size(window.tabs) +
                     " tabs");

    return x;
  };

  const window_id = (id) => record.get(window_ids, id);
  const tab_id = (id) => record.get(tab_ids, id);

  const check_window = (index, window) => {
    assert(record.get(list.get(db.get(namespace), index), "id") ===
           record.get(window_ids, window.id));
  };

  const check_tab = (window, index, tab) => {
    check_window(window.index, window);

    const windows = db.get(namespace);
    const tabs = record.get(list.get(windows, window.index), "tabs");

    assert(record.get(list.get(tabs, index), "id") ===
           record.get(tab_ids, tab.id));
  };

  const write_tabs = (window, f) => {
    db.write(namespace, (windows) => {
      f(record.get(list.get(windows, window.index), "tabs"));
    });
  };


  const window_open = ({ window, index }) => {
    assert(window.index === index);

    db.write(namespace, (windows) => {
      list.insert(windows, index, make_new_window(window));
    });
  };

  const window_close = ({ window, index }) => {
    assert(list.size(window.tabs) === 0);

    check_window(index, window);

    db.write(namespace, (windows) => {
      list.remove(windows, index);
    });

    record.remove(window_ids, window.id);
  };

  const tab_open = ({ window, tab, index }) => {
    assert(tab.index === index);
    assert(tab.window === window);

    check_window(window.index, window);

    write_tabs(window, (tabs) => {
      list.insert(tabs, index, make_new_tab(tab));
    });
  };

  const tab_close = ({ window, tab, index, window_closing }) => {
    // Delay by 10 seconds, so that when Chrome closes,
    // it doesn't remove the tabs / windows
    if (window_closing) {
      delay(10000);
    }

    check_tab(window, index, tab);

    write_tabs(window, (tabs) => {
      list.remove(tabs, index);
    });

    record.remove(tab_ids, tab.id);
  };

  const tab_update = ({ old, tab }) => {
    if (old.url !== tab.url) {
      check_tab(tab.window, tab.index, tab);

      write_tabs(tab.window, (tabs) => {
        record.update(list.get(tabs, tab.index), "url", tab.url);
      });
    }
  };

  const tab_move = ({ tab, old_window, new_window, old_index, new_index }) => {
    check_tab(old_window, old_index, tab);
    check_window(new_window.index, new_window);

    write_tabs(old_window, (tabs) => {
      const session_tab = list.get(tabs, old_index);

      list.remove(tabs, old_index);

      write_tabs(new_window, (tabs) => {
        list.insert(tabs, new_index, session_tab);
      });
    });
  };

  const tab_replace = ({ old_id, new_id }) => {
    const x = record.get(tab_ids, old_id);
    record.remove(tab_ids, old_id);
    record.insert(tab_ids, new_id, x);
  };


  const tab_matches = (old_tab, new_tab) =>
    record.get(old_tab, "url") === new_tab.url;

  // If the last tab is a New Tab, then it always matches.
  // This is needed in the situation where the user restarts Chrome,
  // because Chrome will automatically create a New Tab for the user.
  const is_new_tab = (new_tabs, index, new_tab) =>
    // TODO what about restoring crashed sessions ?
    // Don't match empty windows
    list.size(new_tabs) > 1 &&
    index === list.size(new_tabs) - 1 &&
    new_tab.url === "chrome://newtab/";

  const window_matches = (old_window, new_window) => {
    const old_tabs = record.get(old_window, "tabs");
    const new_tabs = new_window.tabs;

    if (list.size(old_tabs) === 0 && list.size(new_tabs) === 0) {
      return true;

    } else if (list.size(old_tabs) >= 1 && list.size(new_tabs) >= 1) {
      // Check that all the old tabs match with the new tabs
      // TODO test this
      return list.all(new_tabs, (new_tab, index) => {
        if (list.has(old_tabs, index)) {
          const old_tab = list.get(old_tabs, index);

          if (tab_matches(old_tab, new_tab) ||
              is_new_tab(new_tabs, index, new_tab)) {
            return true;

          } else {
            const old_url = record.get(old_tab, "url");
            const new_url = new_tab.url;

            console["debug"]("session: old URL \"" +
                             old_url +
                             "\" does not match with new URL \"" +
                             new_url
                             + "\"");
            return false;
          }

        // TODO a tiny bit inefficient: it should stop as soon as it exhausts `old_tabs`
        } else {
          return true;
        }
      });

    } else {
      return false;
    }
  };

  const merge_window = (old_window, new_window) => {
    const old_id = record.get(old_window, "id");

    const old_tabs = record.get(old_window, "tabs");
    const new_tabs = new_window.tabs;

    let i_new = 0;

    const x = make_window(old_id, new_window,
      // TODO test this
      list.map(new_tabs, (new_tab, index) => {
        // Merge with existing tab
        if (list.has(old_tabs, index)) {
          const old_tab = list.get(old_tabs, index);

          if (tab_matches(old_tab, new_tab)) {
            return make_tab(record.get(old_tab, "id"), new_tab);

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
    list.map(new_windows, (new_window, i) => {
      if (list.has(old_windows, i)) {
        const old_window = list.get(old_windows, i);

        if (window_matches(old_window, new_window)) {
          return merge_window(old_window, new_window);
        } else {
          return make_new_window(new_window);
        }

      } else {
        return make_new_window(new_window);
      }
    });

  const init = (new_windows) => {
    const timer_merge = timer.make();

    db.modify(namespace, (old_windows) =>
      merge(old_windows, new_windows));

    timer.done(timer_merge);
    console["debug"]("session: initialized (" +
                     timer.diff(timer_merge) +
                     "ms)");
  };


  return async.done({
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
  });
});
