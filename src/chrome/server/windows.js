import { chrome } from "../../common/globals";
import { throw_error, async_chrome } from "../common/util";
import { assert } from "../../util/assert";
import { async, async_callback } from "../../util/async";
import { each } from "../../util/iterator";
import { make_window, remove_window, focus_window } from "./windows/windows";
import { make_popup, remove_popup, focus_popup } from "./windows/popups";
import { make_tab, remove_tab, focus_tab, replace_tab,
         attach_tab, move_tab, update_tab } from "./windows/tabs";

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

  make_window(info, true);
  make_popup(info, true);
});

chrome["windows"]["onRemoved"]["addListener"]((id) => {
  throw_error();

  remove_window(id);
  remove_popup(id);
});

chrome["windows"]["onFocusChanged"]["addListener"]((id) => {
  throw_error();

  focus_window(id);
  focus_popup(id);
});

chrome["tabs"]["onCreated"]["addListener"]((info) => {
  throw_error();

  make_tab(info, true);
});

chrome["tabs"]["onRemoved"]["addListener"]((id, info) => {
  throw_error();

  remove_tab(id, info);
});

chrome["tabs"]["onActivated"]["addListener"]((info) => {
  throw_error();

  focus_tab(info);
});

chrome["tabs"]["onReplaced"]["addListener"]((new_id, old_id) => {
  throw_error();

  replace_tab(new_id, old_id);
});

chrome["tabs"]["onAttached"]["addListener"]((id, info) => {
  throw_error();

  attach_tab(id, info);
});

chrome["tabs"]["onMoved"]["addListener"]((id, info) => {
  throw_error();

  move_tab(id, info);
});

chrome["tabs"]["onUpdated"]["addListener"]((id, _, tab) => {
  throw_error();

  update_tab(id, tab);
});


const ready = async_callback((success, error) => {
  if (document["readyState"] === "complete") {
    success(undefined);

  } else {
    addEventListener("load", () => {
      success(undefined);
    }, true);
  }
});

const chrome_get_all = () =>
  async_chrome((callback) => {
    chrome["windows"]["getAll"]({ "populate": true }, callback);
  });

// TODO do we need `ready` ?
export const init = async([chrome_get_all(), ready], (a) => {

  each(a, (info) => {
    make_window(info, false);
    make_popup(info, false);
  });

  return {
    windows: {
      get: windows.get,
      open: windows.open,
      on_open: windows.on_open,
      on_close: windows.on_close,
      on_focus: windows.on_focus
    },

    tabs: {
      open: tabs.open,
      on_open: tabs.on_open,
      on_close: tabs.on_close,
      on_update: tabs.on_update,
      on_focus: tabs.on_focus,
      on_move: tabs.on_move,
      on_replace: tabs.on_replace
    },

    popups: {
      open: popups.open,
      on_close: popups.on_close
    }
  };
});
