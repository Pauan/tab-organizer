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
import * as event from "../../../util/event";
import * as list from "../../../util/list";
import * as record from "../../../util/record";
import { chrome } from "../../../common/globals";
import { throw_error, update_indexes, round } from "../../common/util";
import { assert } from "../../../util/assert";
import { window_ids, make_tab } from "./tabs";
import { focus, close, move, maximize } from "./popups";

export { focus, close, move, maximize } from "./popups";


export const on_open  = event.make();
export const on_close = event.make();
export const on_focus = event.make();

export const windows = list.make();


// TODO maybe make a copy ?
export const get_all = () => windows;


let _focused = null;

const _focus = (window, events) => {
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
      event.send(on_focus, {
        old: old,
        new: window
      });
    }
  }
};

const _unfocus = () => {
  const old = _focused;

  if (old !== null) {
    assert(old.focused === true);
    old.focused = false;

    _focused = null;

    event.send(on_focus, {
      old: old,
      new: null
    });
  }
};

const _defocus = (window) => {
  if (window === _focused) {
    _unfocus();
  }
};


export const open = ({ focused = true }, f) => {
  chrome["windows"]["create"]({
    "type": "normal",
    "focused": focused
  }, (window) => {
    throw_error();
    // TODO test this
    f(record.get(window_ids, window["id"]));
  });
};


/*const get_window = (window) =>
  async_chrome((callback) => {
    chrome["windows"]["get"](window.id, { "populate": false }, callback);
  });*/

const make = (info) => {
  return {
    id: info["id"],
    focused: false,
    focused_tab: null,
    // TODO a bit hacky
    // TODO is this correct ?
    index: list.size(windows),
    tabs: list.make()
  };
};

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

export const make_window = (info, events) => {
  if (info["type"] === "normal") {
    const window = make(info);

    record.insert(window_ids, window.id, window);

    // TODO assertions that `window` is not in `windows` ?
    list.push(windows, window);

    if (events) {
      event.send(on_open, {
        window: window,
        index: window.index
      });
    }

    if (info["focused"]) {
      _focus(window, events);
    }

    if (info["tabs"]) {
      list.each(info["tabs"], (tab) => {
        make_tab(tab, events);
      });
    }
  }
};

export const remove_window = (id) => {
  if (record.has(window_ids, id)) {
    const window = record.get(window_ids, id);
    const index = window.index;

    assert(window.id === id);
    assert(list.size(window.tabs) === 0);

    _defocus(window);

    assert(list.get(windows, index) === window);
    // TODO assertions that `window` is no longer in `windows` ?
    list.remove(windows, index);
    update_indexes(windows);

    record.remove(window_ids, window.id);

    window.index = null;

    event.send(on_close, {
      window: window,
      index: index
    });
  }
};

export const focus_window = (id) => {
  if (record.has(window_ids, id)) {
    const window = record.get(window_ids, id);
    assert(window.id === id);

    _focus(window, true);

  } else {
    _unfocus();
  }
};
