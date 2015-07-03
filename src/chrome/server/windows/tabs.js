import { Dict } from "../../../util/mutable/dict";
import { Event } from "../../../util/event";
import { assert } from "../../../util/assert";
import { update_indexes } from "../../common/util";
import { window_ids } from "./windows";


export const on_open    = new Event();
export const on_focus   = new Event();
export const on_close   = new Event();
export const on_replace = new Event();
export const on_move    = new Event();
export const on_update  = new Event();

export const tab_ids = new Dict();


const focus = (tab, events) => {
  const old = tab.window.focused_tab;

  assert(tab !== old);

  if (old !== null) {
    assert(old.focused === true);
    old.focused = false;
  }

  assert(tab.focused === false);
  tab.focused = true;

  tab.window.focused_tab = tab;

  if (events) {
    on_focus.send({
      window: tab.window,
      old: old,
      new: tab
    });
  }
};

const unfocus = (window) => {
  const old = window.focused_tab;

  if (old !== null) {
    assert(old.focused === true);
    old.focused = false;

    window.focused_tab = null;

    on_focus.send({
      window: window,
      old: old,
      new: null
    });
  }
};

const defocus = (window, tab) => {
  if (tab === window.focused_tab) {
    unfocus(window);
  }
};


const get_favicon = (info) => {
  if (info["favIconUrl"] && /^data:/["test"](info["favIconUrl"])) {
    return info["favIconUrl"];
  } else if (info["url"]) {
    return "chrome://favicon/" + info["url"];
  } else {
    return null;
  }
};

class Tab {
  constructor(info, window) {
    this.id      = info["id"];
    this.index   = info["index"];
    this.window  = window;
    this.focused = false;

    this.pinned  = info["pinned"];
    this.url     = info["url"] || null;
    this.title   = info["title"] || null;
    this.favicon = get_favicon(info);
  }
}

export const update_tab = (id, info) => {
  if (tab_ids.has(id)) {
    const tab = tab_ids.get(id);

    assert(tab.id === info["id"]);
    assert(tab.index === info["index"]);
    assert(tab.window.id === info["windowId"]);
    assert(tab.focused === info["active"]);

    const old = {
      pinned:  tab.pinned,
      url:     tab.url,
      title:   tab.title,
      favicon: tab.favicon
    };

    // TODO code duplication
    tab.pinned  = info["pinned"];
    tab.url     = info["url"] || null;
    tab.title   = info["title"] || null;
    tab.favicon = get_favicon(info);

    if (old.pinned  !== tab.pinned ||
        old.url     !== tab.url    ||
        old.title   !== tab.title  ||
        old.favicon !== tab.favicon) {

      on_update.send({
        old: old,
        tab: tab
      });
    }
  }
};

export const make_tab = (info, events) => {
  if (window_ids.has(info["windowId"])) {
    const window = window_ids.get(info["windowId"]);
    const tab = new Tab(info, window);

    tab_ids.add(tab.id, tab);

    // TODO assert that tab does not exist in window.tabs ?
    window.tabs.insert(tab.index, tab);
    update_indexes(window.tabs);

    if (events) {
      on_open.send({
        window: window,
        tab: tab,
        index: tab.index
      });
    }

    if (info["active"]) {
      focus(tab, events);
    }
  }
};

export const remove_tab = (id, { "windowId": window_id,
                                 "isWindowClosing": window_closing }) => {
  if (tab_ids.has(id)) {
    const tab = tab_ids.get(id);
    const index = tab.index;
    const window = tab.window;
    const tabs = window.tabs;

    assert(tab.id === id);
    assert(window.id === window_id);

    defocus(window, tab);

    // TODO assert that tab is no longer in tabs ?
    assert(tabs.get(index) === tab);
    tabs.remove(index);
    update_indexes(tabs);

    tab_ids.remove(tab.id);

    tab.index = null;
    tab.window = null;

    on_close.send({
      window: window,
      tab: tab,
      index: index,
      window_closing: window_closing
    });
  }
};

export const focus_tab = ({ "tabId": tabId, "windowId": windowId }) => {
  if (tab_ids.has(tabId)) {
    const tab = tab_ids.get(tabId);

    assert(tab.id === tabId);
    assert(tab.window.id === windowId);

    focus(tab, true);
  }
};

export const replace_tab = (new_id, old_id) => {
  if (tab_ids.has(old_id)) {
    const tab = tab_ids.get(old_id);

    assert(tab.id === old_id);
    assert(old_id !== new_id);

    tab.id = new_id;
    tab_ids.remove(old_id);
    tab_ids.set(new_id, tab);

    on_replace.send({
      old_id: old_id,
      new_id: new_id,
      tab: tab
    });

    // TODO what about updating the tab ?
    debugger;
  }
};

// TODO handle focus
export const attach_tab = (id, { "newWindowId": window_id,
                                 "newPosition": new_index }) => {
  if (tab_ids.has(id)) {
    const tab = tab_ids.get(id);
    const old_index = tab.index;

    const old_window = tab.window;
    const new_window = window_ids.get(window_id);

    const old_tabs = old_window.tabs;
    const new_tabs = new_window.tabs;

    assert(tab.id = id);
    assert(new_window.id === window_id);

    assert(old_window !== new_window || old_index !== new_index);

    // TODO assert that tab is no longer in tabs ?
    assert(old_tabs.get(old_index) === tab);
    old_tabs.remove(old_index);
    new_tabs.insert(new_index, tab);

    update_indexes(old_tabs);
    update_indexes(new_tabs);

    tab.window = new_window;
    tab.index = new_index;

    on_move.send({
      tab: tab,
      old_window: old_window,
      new_window: new_window,
      old_index: old_index,
      new_index: new_index
    });
  }
};

export const move_tab = (id, { "windowId": window_id,
                               "fromIndex": old_index,
                               "toIndex": new_index }) => {
  if (tab_ids.has(id)) {
    assert(old_index !== new_index);

    const tab = tab_ids.get(id);
    const window = tab.window;
    const tabs = window.tabs;

    assert(tab.id === id);
    assert(window.id === window_id);
    assert(tab.index === old_index);

    assert(tabs.get(old_index) === tab);
    tabs.remove(old_index);
    tabs.insert(new_index, tab);
    update_indexes(tabs);

    tab.index = new_index;

    on_move.send({
      tab: tab,
      old_window: window,
      new_window: window,
      old_index: old_index,
      new_index: new_index
    });
  }
};
