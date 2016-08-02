import * as dom from "../../../../util/dom";
import * as async from "../../../../util/async";
import * as mutable from "../../../../util/mutable";
import { chrome } from "../../../../common/globals";
import { category, row, text } from "../common";


export const init = async.all([], () => {

  // TODO it's gross to hardcode this
  // TODO can I rely on this URL not changing ?
  const keyboard_shortcut_url = "chrome://extensions/configureCommands";

  const open_keyboard_url = () => {
    // TODO lib:extension module for handling async stuff like this ?
    // TODO error handling
    // TODO use `callback` ?
    chrome["tabs"]["getCurrent"]((tab) => {
      chrome["tabs"]["create"]({
        "url": keyboard_shortcut_url,
        "windowId": tab["windowId"],
        "openerTabId": tab["id"],
        "index": tab["index"] + 1
      });
    });
  };

  const style_link = dom.make_style({
    "cursor": mutable.always("auto"),
  });

  const ui_keyboard = () =>
    row([
      text("Click "),

      dom.link((e) => [
        // TODO a little bit hacky
        dom.add_style(e, style_link),

        dom.set_target(e, mutable.always("_blank")),
        dom.set_value(e, mutable.always("here")),
        dom.set_url(e, mutable.always(keyboard_shortcut_url)),

        // TODO hacky, but needed to work around a security restriction in Chrome
        dom.on_left_click(e, open_keyboard_url),
        dom.on_middle_click(e, open_keyboard_url)
      ]),

      text(" to configure a keyboard shortcut for opening the popup"),
    ]);


  const ui = () =>
    category("Keyboard", [
      ui_keyboard()
    ]);


  return async.done({ ui });
});
