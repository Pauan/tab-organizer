import { init as init_chrome } from "../chrome/server";
import { map, each } from "../util/iterator";
import { async } from "../util/async";
import { List } from "../util/list";
import { Dict } from "../util/dict";
import { Record } from "../util/record";
import { timestamp } from "../util/timestamp";
import { assert } from "../util/assert";

export const init = async(function* () {
  const { db, windows } = yield init_chrome;

  const saved = new List(db.get("session.windows", []));

  const window_ids = new Dict();
  const tab_ids    = new Dict();

  const make_tab = (tab) => {
    const x = new Record({
      "id": "" + timestamp(),
      "url": tab.url
    });

    assert(!tab_ids.has(tab.id));
    tab_ids.set(tab.id, x);

    return x;
  };

  const make_window = (window, tabs) => {
    const x = new Record({
      "id": "" + timestamp(),
      "tabs": new List(tabs)
    });

    assert(!window_ids.has(window.id));
    window_ids.set(window.id, x);

    return x;
  };

  const window_id = (id) => window_ids.get(id).get("id");
  const tab_id = (id) => tab_ids.get(id).get("id");

  const save = () => {
    db.set("session.windows", saved);
  };

  const save_delay = () => {
    // Delay by 10 seconds, so that when Chrome closes,
    // it doesn't remove the tabs / windows
    db.delay("session.windows", 10000, () => {
      save();
    });
  };

  const window_open = ({ window, index }) => {
    assert(window.index === index);

    const x = make_window(window, map(window.tabs, make_tab));

    saved.insert(window.index, x);

    save();
  };

  const window_close = ({ window, index }) => {
    assert(window.tabs.size === 0);
    assert(saved.get(index) === window_ids.get(window.id));

    window_ids.remove(window.id);
    saved.remove(index);

    save_delay();
  };

  const tab_open = ({ window, tab, index }) => {
    const session_window = window_ids.get(window.id);
    const x = make_tab(tab);

    session_window.get("tabs").insert(index, x);

    save();
  };

  const tab_close = ({ window, tab, index, window_closing }) => {
    const session_window = window_ids.get(window.id);
    const session_tab = tab_ids.get(tab.id);
    const tabs = session_window.get("tabs");

    tab_ids.remove(tab.id);
    assert(tabs.get(index) === session_tab);
    tabs.remove(index);

    console.log(window_closing);

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

  const merge_saved = (windows) => {
    saved.clear();

    each(windows, (window) => {

    });

    save();
  };

  merge_saved(windows.get_windows());

  windows.on_tab_replace.listen((info) => {
    tab_replace(info);
  });

  return {
    window_id,
    tab_id,
    window_open,
    window_close,
    tab_open,
    tab_close,
    tab_update,
    tab_move
  };
});
