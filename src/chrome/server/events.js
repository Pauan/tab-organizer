import { throw_error } from "../common/util";
import { assert } from "../../util/assert";
import { make_window, remove_window, focus_window } from "./windows";
import { make_popup, remove_popup, focus_popup } from "./popups";
import { make_tab, remove_tab, focus_tab, replace_tab } from "./tabs";


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
