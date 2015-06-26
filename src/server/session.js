import * as chrome from "../chrome/server";
import { each } from "../util/iterator";
import { async } from "../util/async";
import { Event } from "../util/event";
import { List } from "../util/list";
import { Dict } from "../util/dict";
import { Record } from "../util/record";
import { assert, fail } from "../util/assert";

export const windows = new List();

const window_ids = new Dict();
const tab_ids    = new Dict();

export const event_window_open  = new Event();
export const event_window_close = new Event();
export const event_window_focus = new Event();

export const event_tab_open     = new Event();
export const event_tab_close    = new Event();
export const event_tab_focus    = new Event();
export const event_tab_attach   = new Event();
export const event_tab_detach   = new Event();
export const event_tab_move     = new Event();
export const event_tab_update   = new Event();

export const init_session = async(function* () {
  yield chrome.init_chrome;

  each(chrome.windows, (window) => {

  });

  chrome.event_window_open.on((info) => {

  });
});
