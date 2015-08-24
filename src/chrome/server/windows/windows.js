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
import { chrome } from "../../../common/globals";
import { Event } from "../../../util/event";
import { List } from "../../../util/mutable/list";
import { Dict } from "../../../util/mutable/dict";
import { throw_error, update_indexes, round } from "../../common/util";
import { assert } from "../../../util/assert";
import { each } from "../../../util/iterator";
import { make_tab } from "./tabs";
import { Popup } from "./popups";


const _on_open  = Event();
const _on_close = Event();
const _on_focus = Event();

export const on_open  = _on_open.receive;
export const on_close = _on_close.receive;
export const on_focus = _on_focus.receive;

export const windows    = new List();
export const window_ids = new Dict();


// TODO maybe make a copy ?
export const get = () => windows;


let _focused = null;

const focus = (window, events) => {
  const old = _focused;

  if (window === old) {
    assert(window.focused === true);

  } else {
    if (old !== null) {
      assert(old.focused === true);
      old.focused = false;
    }

    assert(window.focused === false);
    window.focused = true;

    _focused = window;

    if (events) {
      _on_focus.send({
        old: old,
        new: window
      });
    }
  }
};

const unfocus = () => {
  const old = _focused;

  if (old !== null) {
    assert(old.focused === true);
    old.focused = false;

    _focused = null;

    _on_focus.send({
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


export const open = ({ focused = true }, f) => {
  chrome["windows"]["create"]({
    "type": "normal",
    "focused": focused
  }, (window) => {
    throw_error();
    // TODO test this
    f(window_ids.get(window["id"]));
  });
};


/*const get_window = (window) =>
  async_chrome((callback) => {
    chrome["windows"]["get"](window.id, { "populate": false }, callback);
  });*/

class Window extends Popup {
  constructor(info) {
    super(info);

    this.focused = false;
    this.focused_tab = null;
    this.index = windows.size;
    this.tabs = new List();
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
}

export const make_window = (info, events) => {
  if (info["type"] === "normal") {
    const window = new Window(info);

    window_ids.insert(window.id, window);

    // TODO assertions that `window` is not in `windows` ?
    windows.push(window);

    if (events) {
      _on_open.send({
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

    _on_close.send({
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
