import { init as init_chrome } from "../chrome/server";
import { map, each, all, zip, indexed } from "../util/iterator";
import { async } from "../util/async";
import { List } from "../util/list";
import { Dict } from "../util/dict";
import { Timer } from "../util/time";
import { Record } from "../util/record";
import { timestamp } from "../util/timestamp";
import { assert } from "../util/assert";


const new_id = () => "" + timestamp();

const deserialize = (a) =>
  new List(map(a, (window) => {
    // TODO test this
    window["tabs"] = new List(map(window["tabs"], (tab) => new Record(tab)));
    return new Record(window);
  }));


export const init = async(function* () {
  const { db, windows } = yield init_chrome;

  const timer_deserialize = new Timer();
  let saved = deserialize(db.get("session.windows", []));
  timer_deserialize.done();

  const save = () => {
    db.set("session.windows", saved);
  };

  const save_delay = () => {
    // TODO maybe this should delay everything, not just "session.windows" ?
    // Delay by 10 seconds, so that when Chrome closes,
    // it doesn't remove the tabs / windows
    db.delay("session.windows", 10000);
    save();
  };


  const window_ids = new Dict();
  const tab_ids    = new Dict();

  const init_tab = (tab, x) => {
    assert(!tab_ids.has(tab.id));
    tab_ids.set(tab.id, x);
  };

  const init_window = (window, x) => {
    assert(!window_ids.has(window.id));
    window_ids.set(window.id, x);
  };

  const make_tab = (id, tab) => {
    const x = new Record({
      "id": id,
      "url": tab.url
    });

    init_tab(tab, x);

    return x;
  };

  const make_window = (id, window, tabs) => {
    const x = new Record({
      "id": id,
      "tabs": new List(tabs)
    });

    init_window(window, x);

    return x;
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

  const window_id = (id) => window_ids.get(id).get("id");
  const tab_id = (id) => tab_ids.get(id).get("id");


  const window_open = ({ window, index }) => {
    assert(window.index === index);

    const x = make_new_window(window);
    saved.insert(index, x);

    save();
  };

  const window_close = ({ window, index }) => {
    assert(window.tabs.size === 0);
    assert(saved.get(index) === window_ids.get(window.id));

    window_ids.remove(window.id);
    saved.remove(index);

    save();
  };

  const tab_open = ({ window, tab, index }) => {
    assert(tab.index === index);

    const session_window = window_ids.get(window.id);
    const x = make_new_tab(tab);

    session_window.get("tabs").insert(index, x);

    save();
  };

  const tab_close = ({ window, tab, index, window_closing }) => {
    const session_window = window_ids.get(window.id);
    const session_tab = tab_ids.get(tab.id);
    const tabs = session_window.get("tabs");

    assert(tabs.get(index) === session_tab);

    tab_ids.remove(tab.id);
    tabs.remove(index);

    if (window_closing) {
      save_delay();
    } else {
      save();
    }
  };

  const tab_update = ({ old, tab }) => {
    if (old.url !== tab.url) {
      const x = tab_ids.get(tab.id);
      x.set("url", tab.url);
      save();
    }
  };

  const tab_move = ({ tab, old_window, new_window, old_index, new_index }) => {
    const session_window_old = window_ids.get(old_window.id);
    const session_window_new = window_ids.get(new_window.id);
    const old_tabs = session_window_old.get("tabs");
    const new_tabs = session_window_new.get("tabs");
    const session_tab = tab_ids.get(tab.id);

    assert(old_tabs.get(old_index) === session_tab);

    old_tabs.remove(old_index);
    new_tabs.insert(new_index, session_tab);

    save();
  };

  const tab_replace = ({ old_id, new_id }) => {
    const tab = tab_ids.get(old_id);
    tab_ids.remove(old_id);
    tab_ids.set(new_id, tab);
  };


  const tab_matches = (old_tab, new_tab) => {
    return old_tab.get("url") === new_tab.url;
  };

  const window_matches = (old_window, new_window) => {
    const old_tabs = old_window.get("tabs");
    const new_tabs = new_window.tabs;

    if (old_tabs.size === 0 && new_tabs.size === 0) {
      return true;

    } else if (old_tabs.size >= 1 && new_tabs.size >= 1) {
      // Check that all the old tabs match with the new tabs
      // TODO test this
      return all(zip(old_tabs, new_tabs), ([old_tab, new_tab]) => {
        console.log(old_tab, new_tab);
        return tab_matches(old_tab, new_tab);
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
      map(indexed(new_tabs), ([i, new_tab]) => {
        // Merge with existing tab
        if (old_tabs.has(i)) {
          const old_tab = old_tabs.get(i);
          return make_tab(old_tab.get("id"), new_tab);

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
    new List(map(indexed(new_windows), ([i, new_window]) => {
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

  saved = merge(saved, windows.get_windows());
  save();

  timer_merge.done();
  console["debug"]("session: initialized (deserialize " +
                   timer_deserialize.diff() +
                   "ms) (merge " +
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
