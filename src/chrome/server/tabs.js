import { Dict } from "../../util/dict";
import { Event } from "../../util/event";
import { assert, fail } from "../../util/assert";
import { update_indexes } from "../common/util";
import { window_ids } from "./windows";


export const event_tab_open    = new Event();
export const event_tab_focus   = new Event();
export const event_tab_close   = new Event();
export const event_tab_replace = new Event();

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
    event_tab_focus.send({
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

    event_tab_focus.send({
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
    this.id = info["id"];
    this.index = info["index"];
    this.pinned = info["pinned"];
    this.url = info["url"] || null;
    this.title = info["title"] || null;
    this.favicon = get_favicon(info);
    this.window = window;
    this.focused = false;
  }

  toJSON() {
    fail();
  }
}

export const make_tab = (info, events) => {
  if (window_ids.has(info["windowId"])) {
    const window = window_ids.get(info["windowId"]);
    const tab = new Tab(info, window);

    assert(!tab_ids.has(tab.id));
    tab_ids.set(tab.id, tab);

    // TODO assert that tab does not exist in window.tabs ?
    window.tabs.insert(tab.index, tab);

    if (events) {
      event_tab_open.send({
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

export const remove_tab = (id, info) => {
  if (tab_ids.has(id)) {
    const tab = tab_ids.get(id);
    const index = tab.index;
    const window = tab.window;
    const tabs = window.tabs;

    assert(tab.id === id);
    assert(window.id === info["windowId"]);

    defocus(window, tab);

    // TODO assert that tab is no longer in tabs ?
    assert(tabs.get(index) === tab);
    tabs.remove(index);
    update_indexes(tabs);

    tab_ids.remove(tab.id);

    tab.index = null;
    tab.window = null;

    event_tab_close.send({
      window: window,
      tab: tab,
      index: index
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

    tab.id = new_id;
    tab_ids.remove(old_id);
    tab_ids.set(new_id, tab);

    event_tab_replace.send({
      old_id: old_id,
      new_id: new_id
      tab: tab
    });

    // TODO what about updating the tab ?
  }
};
