import * as record from "../../../util/record";
import * as list from "../../../util/list";
import * as event from "../../../util/event";
import { chrome } from "../../../common/globals";
import { assert } from "../../../util/assert";
import { update_indexes, throw_error } from "../../common/util";
import { window_ids } from "./windows";


export const on_open    = event.make();
export const on_focus   = event.make();
export const on_close   = event.make();
export const on_replace = event.make();
export const on_move    = event.make();
export const on_update  = event.make();

export const tab_ids = record.make();


const _focus = (tab, events) => {
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
    event.send(on_focus, {
      window: tab.window,
      old: old,
      new: tab
    });
  }
};

const _unfocus = (window) => {
  const old = window.focused_tab;

  if (old !== null) {
    assert(old.focused === true);
    old.focused = false;

    window.focused_tab = null;

    event.send(on_focus, {
      window: window,
      old: old,
      new: null
    });
  }
};

const _defocus = (window, tab) => {
  if (tab === window.focused_tab) {
    _unfocus(window);
  }
};


export const open = ({ url }, f) => {
  chrome["tabs"]["create"]({
    "url": url
  }, (info) => {
    throw_error();
    f(record.get(tab_ids, info["id"]));
  });
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

const make = (info, window) => {
  return {
    id:       info["id"],
    index:    info["index"],
    window:   window,
    focused:  false,

    pinned:   info["pinned"],
    url:      info["url"] || null,
    title:    info["title"] || null,
    favicon:  get_favicon(info)
  };
};

export const pin = (tab) => {
  chrome["tabs"]["update"](tab.id, {
    "pinned": true
  });
};

export const unpin = (tab) => {
  chrome["tabs"]["update"](tab.id, {
    "pinned": false
  });
};

export const move = (tab, window, index) => {
  chrome["tabs"]["move"](tab.id, {
    "windowId": window.id,
    "index": index
  });
};

export const focus = (tab) => {
  chrome["tabs"]["update"](tab.id, {
    "active": true
  });

  chrome["windows"]["update"](tab.window.id, {
    "focused": true
  });
};

export const close = (tab) => {
  chrome["tabs"]["remove"](tab.id);
};


export const update_tab = (id, info) => {
  if (record.has(tab_ids, id)) {
    const tab = record.get(tab_ids, id);

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

      event.send(on_update, {
        old: old,
        tab: tab
      });
    }
  }
};

export const make_tab = (info, events) => {
  if (record.has(window_ids, info["windowId"])) {
    const window = record.get(window_ids, info["windowId"]);
    const tab = make(info, window);

    record.insert(tab_ids, tab.id, tab);

    // TODO assert that tab does not exist in window.tabs ?
    list.insert(window.tabs, tab.index, tab);
    update_indexes(window.tabs);

    if (events) {
      event.send(on_open, {
        window: window,
        tab: tab,
        index: tab.index
      });
    }

    if (info["active"]) {
      _focus(tab, events);
    }
  }
};

export const remove_tab = (id, { "windowId": window_id,
                                 "isWindowClosing": window_closing }) => {
  if (record.has(tab_ids, id)) {
    const tab = record.get(tab_ids, id);
    const index = tab.index;
    const window = tab.window;
    const tabs = window.tabs;

    assert(tab.id === id);
    assert(window.id === window_id);

    _defocus(window, tab);

    // TODO assert that tab is no longer in tabs ?
    assert(list.get(tabs, index) === tab);
    list.remove(tabs, index);
    update_indexes(tabs);

    record.remove(tab_ids, tab.id);

    tab.index = null;
    tab.window = null;

    event.send(on_close, {
      window: window,
      tab: tab,
      index: index,
      window_closing: window_closing
    });
  }
};

export const focus_tab = ({ "tabId": tabId, "windowId": windowId }) => {
  if (record.has(tab_ids, tabId)) {
    const tab = record.get(tab_ids, tabId);

    assert(tab.id === tabId);
    assert(tab.window.id === windowId);

    _focus(tab, true);
  }
};

export const replace_tab = (new_id, old_id) => {
  if (record.has(tab_ids, old_id)) {
    const tab = record.get(tab_ids, old_id);

    assert(tab.id === old_id);
    assert(old_id !== new_id);

    tab.id = new_id;
    record.remove(tab_ids, old_id);
    record.insert(tab_ids, new_id, tab);

    event.send(on_replace, {
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
  if (record.has(tab_ids, id)) {
    const tab = record.get(tab_ids, id);
    const old_index = tab.index;

    const old_window = tab.window;
    const new_window = record.get(window_ids, window_id);

    const old_tabs = old_window.tabs;
    const new_tabs = new_window.tabs;

    assert(tab.id = id);
    assert(new_window.id === window_id);

    assert(old_window !== new_window || old_index !== new_index);

    // TODO assert that tab is no longer in tabs ?
    assert(list.get(old_tabs, old_index) === tab);
    list.remove(old_tabs, old_index);
    list.insert(new_tabs, new_index, tab);

    update_indexes(old_tabs);
    update_indexes(new_tabs);

    tab.window = new_window;
    tab.index = new_index;

    event.send(on_move, {
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
  if (record.has(tab_ids, id)) {
    assert(old_index !== new_index);

    const tab = record.get(tab_ids, id);
    const window = tab.window;
    const tabs = window.tabs;

    assert(tab.id === id);
    assert(window.id === window_id);
    assert(tab.index === old_index);

    assert(list.get(tabs, old_index) === tab);
    list.remove(tabs, old_index);
    list.insert(tabs, new_index, tab);
    update_indexes(tabs);

    tab.index = new_index;

    event.send(on_move, {
      tab: tab,
      old_window: window,
      new_window: window,
      old_index: old_index,
      new_index: new_index
    });
  }
};
