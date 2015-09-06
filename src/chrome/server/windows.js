import * as list from "../../util/list";
import { chrome } from "../../common/globals";
import { throw_error, async_chrome } from "../common/util";
import { assert } from "../../util/assert";
import { async, async_callback, success } from "../../util/async";

// Exports
import * as windows from "./windows/windows";
import * as tabs from "./windows/tabs";
import * as popups from "./windows/popups";


chrome["windows"]["onCreated"]["addListener"]((info) => {
  throw_error();

  assert(info["focused"] === false);

  if (info["tabs"]) {
    assert(info["tabs"]["length"] === 0);
  }

  windows.make_window(info, true);
  popups.make_popup(info, true);
});

chrome["windows"]["onRemoved"]["addListener"]((id) => {
  throw_error();

  windows.remove_window(id);
  popups.remove_popup(id);
});

chrome["windows"]["onFocusChanged"]["addListener"]((id) => {
  throw_error();

  windows.focus_window(id);
  popups.focus_popup(id);
});

chrome["tabs"]["onCreated"]["addListener"]((info) => {
  throw_error();

  tabs.make_tab(info, true);
});

chrome["tabs"]["onRemoved"]["addListener"]((id, info) => {
  throw_error();

  tabs.remove_tab(id, info);
});

chrome["tabs"]["onActivated"]["addListener"]((info) => {
  throw_error();

  tabs.focus_tab(info);
});

chrome["tabs"]["onReplaced"]["addListener"]((new_id, old_id) => {
  throw_error();

  tabs.replace_tab(new_id, old_id);
});

chrome["tabs"]["onAttached"]["addListener"]((id, info) => {
  throw_error();

  tabs.attach_tab(id, info);
});

chrome["tabs"]["onMoved"]["addListener"]((id, info) => {
  throw_error();

  tabs.move_tab(id, info);
});

chrome["tabs"]["onUpdated"]["addListener"]((id, _, tab) => {
  throw_error();

  tabs.update_tab(id, tab);
});


const ready = async_callback((out) => {
  if (document["readyState"] === "complete") {
    success(out, undefined);

  } else {
    addEventListener("load", () => {
      success(out, undefined);
    }, true);
  }
});

const chrome_get_all = () =>
  async_chrome((callback) => {
    chrome["windows"]["getAll"]({ "populate": true }, callback);
  });

// TODO do we need `ready` ?
export const init = async([chrome_get_all(), ready], (a) => {

  list.each(a, (info) => {
    windows.make_window(info, false);
    popups.make_popup(info, false);
  });

  return {
    windows: {
      get_all: windows.get_all,

      open: windows.open,
      focus: windows.focus,
      close: windows.close,
      move: windows.move,
      maximize: windows.maximize,

      on_open: windows.on_open,
      on_close: windows.on_close,
      on_focus: windows.on_focus
    },

    tabs: {
      open: tabs.open,
      pin: tabs.pin,
      unpin: tabs.unpin,
      move: tabs.move,
      focus: tabs.focus,
      close: tabs.close,

      on_open: tabs.on_open,
      on_close: tabs.on_close,
      on_update: tabs.on_update,
      on_focus: tabs.on_focus,
      on_move: tabs.on_move,
      on_replace: tabs.on_replace
    },

    popups: {
      open: popups.open,
      focus: popups.focus,
      close: popups.close,
      move: popups.move,
      maximize: popups.maximize,
      get_size: popups.get_size,

      on_close: popups.on_close
    }
  };
});
