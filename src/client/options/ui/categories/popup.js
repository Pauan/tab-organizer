import * as dom from "../../../dom";
import { async } from "../../../../util/async";
import { always } from "../../../../util/ref";
import { chrome } from "../../../../common/globals";
import { category, row, text } from "../common";
import { init as init_textbox } from "../textbox";
import { init as init_dropdown } from "../dropdown";


export const init = async([init_textbox,
                           init_dropdown],
                          ({ textbox },
                           { dropdown }) => {

  // TODO it's gross to hardcode this
  // TODO can I rely on this URL not changing ?
  const keyboard_shortcut_url = "chrome://extensions/configureCommands";

  const open_keyboard_url = () => {
    // TODO lib:extension module for handling async stuff like this ?
    chrome["tabs"]["getCurrent"]((tab) => {
      chrome["tabs"]["create"]({
        "url": keyboard_shortcut_url,
        "windowId": tab["windowId"],
        "openerTabId": tab["id"],
        "index": tab["index"] + 1
      });
    });
  };

  const style_link = dom.style({
    "cursor": always("auto")
  });

  const ui_keyboard = () =>
    row([
      text("You can go "),

      dom.link((e) => [
        // TODO a little bit hacky
        e.set_style(style_link, always(true)),

        e.target(always("_blank")),
        e.value(always("here")),
        e.url(always(keyboard_shortcut_url)),

        // TODO hacky, but needed to work around a security restriction in Chrome
        e.on_left_click(open_keyboard_url),
        e.on_middle_click(open_keyboard_url)
      ]),

      text(" to configure a keyboard shortcut for opening the popup"),
    ]);

  const ui = () =>
    category("Popup", [
      ui_keyboard()
    ]);


  return { ui };
});
