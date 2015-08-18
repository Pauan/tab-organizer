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

  const keyboard_shortcut_url = "chrome://extensions/configureCommands";

  const ui_keyboard = () =>
    row([
      text("Configure a keyboard shortcut for opening the popup "),

      dom.link((e) => [
        e.target(always("_blank")),
        e.value(always("here")),
        e.url(always(keyboard_shortcut_url)),

        // TODO hacky, but needed to work around a security restriction in Chrome
        e.on_left_click(() => {
          // TODO lib:extension module for handling async stuff like this ?
          chrome["tabs"]["getCurrent"]((tab) => {
            chrome["tabs"]["create"]({
              "url": keyboard_shortcut_url,
              "windowId": tab["windowId"],
              "openerTabId": tab["id"],
              "index": tab["index"] + 1
            });
          });
        })
      ])
    ]);

  const ui = () =>
    category("Popup", [
      ui_keyboard()
    ]);


  return { ui };
});
