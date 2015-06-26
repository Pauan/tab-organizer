/**
 * @ Tab lifecycle
 *
 *  @ When opening a window
 *    windows.onCreated
 *    window.create
 *
 *   @ When removing a window
 *     windows.remove
 *     windows.onRemoved
 *
 *   @ When creating
 *     @ If it's a new window
 *       windows.onFocusChanged (old)
 *       windows.onCreated
 *     tabs.onCreated
 *     tabs.onActivated
 *     tabs.create
 *     @ If it's not loaded from cache
 *       tabs.onUpdated
 *
 *   @ When updating
 *     tabs.update
 *     tabs.onUpdated
 *
 *   @ When focusing a different tab
 *     tabs.onActivated
 *     tabs.update
 *
 *   @ When moving in the same window
 *     tabs.onMoved
 *     tabs.move
 *
 *   @ When moving to another window
 *     @ If the old window still has tabs in it
 *       windows.onCreated
 *       tabs.onDetached
 *       tabs.onActivated (old window)
 *       tabs.onAttached
 *       tabs.onActivated (new window)
 *
 *       tabs.onDetached
 *       tabs.onAttached
 *       tabs.onActivated (new window)
 *       windows.onRemoved
 *
 *     @ If the old window does not still have tabs in it
 *       tabs.onDetached
 *       tabs.onAttached
 *       tabs.onActivated (new window)
 *       windows.onRemoved
 *
 *   @ When removing
 *     tabs.onRemoved
 *     @ If the old window still has tabs in it
 *       tabs.onActivated
 *       tabs.remove
 *     @ If the old window does not still have tabs in it
 *       tabs.remove
 *       windows.onRemoved
 *
 *
 * windows.onCreated
 */
import { Event } from "../../util/event";
import { List } from "../../util/list";
import { Dict } from "../../util/dict";
import { async, ignore } from "../../util/async";
import { async_chrome, update_indexes, dimensions } from "../common/util";
import { assert, fail } from "../../util/assert";
import { each } from "../../util/iterator";
import { make_tab } from "./tabs";


export const event_window_open  = new Event();
export const event_window_close = new Event();
export const event_window_focus = new Event();

export const windows    = new List();
export const window_ids = new Dict();


let _focused = null;

const focus = (window, events) => {
  const old = _focused;

  assert(window !== old);

  if (old !== null) {
    assert(old.focused === true);
    old.focused = false;
  }

  assert(window.focused === false);
  window.focused = true;

  _focused = window;

  if (events) {
    event_window_focus.send({
      old: old,
      new: window
    });
  }
};

const unfocus = () => {
  const old = _focused;

  if (old !== null) {
    assert(old.focused === true);
    old.focused = false;

    _focused = null;

    event_window_focus.send({
      old: old,
      new: null
    });
  }
};

const defocus = (window) => {
  if (window === _focused) {
    unfocus();
  }
};


export const open_window = ({ focused = true, state = "normal" }) => async(function* () {
  const window = yield async_chrome(chrome["windows"]["create"], {
    "focused": focused,
    "type": "normal",
    //"state": state
  });

  return window_ids.get(window["id"]);
});


const get_window = (window) =>
  async_chrome(chrome["windows"]["get"], window.id, { "populate": false });

const update_window = (window, info) =>
  ignore(async_chrome(chrome["windows"]["update"], window.id, info));

class Window {
  constructor(info) {
    this.id = info["id"];
    this.focused = false;
    this.focused_tab = null;
    this.index = windows.size;
    this.tabs = new List();
  }

  focus() {
    return update_window(this, { "focused": true });
  }

  // TODO this should probably wait until after the Window is removed from `windows`
  close() {
    return ignore(async_chrome(chrome["windows"]["remove"], this.id));
  }

  /*get_state() {
    const self = this;

    return async(function* () {
      const x = yield get_window(self);
      return x["state"];
    });
  }

  get_dimensions() {
    const self = this;

    return async(function* () {
      const x = yield get_window(self);

      return {
        left: x["left"],
        top: x["top"],
        width: x["width"],
        height: x["height"]
      };
    });
  }

  // TODO rename to minimize/maximize/etc. ?
  set_state(state) {
    return update_window(this, { "state": state });
  }

  // TODO rename to move ?
  set_dimensions(info) {
    return update_window(this, dimensions(info));
  }*/

  toJSON() {
    fail();
  }
}

export const make_window = (info, events) => {
  if (info["type"] === "normal") {
    const window = new Window(info);

    assert(!window_ids.has(window.id));
    window_ids.set(window.id, window);

    // TODO assertions that `window` is not in `windows` ?
    windows.push(window);

    if (events) {
      event_window_open.send({
        window: window,
        index: window.index
      });
    }

    if (info["focused"]) {
      focus(window, events);
    }

    if (info["tabs"]) {
      each(info["tabs"], (tab) => {
        make_tab(tab, events);
      });
    }
  }
};

export const remove_window = (id) => {
  if (window_ids.has(id)) {
    const window = window_ids.get(id);
    const index = window.index;

    assert(window.id === id);
    assert(window.tabs.size === 0);

    defocus(window);

    assert(windows.get(index) === window);
    // TODO assertions that `window` is no longer in `windows` ?
    windows.remove(index);
    update_indexes(windows);

    window_ids.remove(window.id);

    window.index = null;

    event_window_close.send({
      window: window,
      index: index
    });
  }
};

export const focus_window = (id) => {
  if (window_ids.has(id)) {
    const window = window_ids.get(id);
    assert(window.id === id);

    focus(window, true);

  } else {
    unfocus();
  }
};
