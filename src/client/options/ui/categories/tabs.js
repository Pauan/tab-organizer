import * as dom from "../../../../util/dom";
import * as async from "../../../../util/async";
import * as ref from "../../../../util/ref";
import { category, header, indent,
         row, text, separator } from "../common";
import { init as init_radio } from "../radio";
import { init as init_dropdown } from "../dropdown";


export const init = async.all([init_radio,
                               init_dropdown],
                              ({ radio },
                               { dropdown }) => {

  const ui = () =>
    category("Tabs", [
      row([
        text("Show the "),

        dom.image((e) => [
          dom.set_alt(e, ref.always("close")),
          dom.set_tooltip(e, ref.always("close")),
          dom.set_url(e, ref.always("data/images/button-close.png"))
        ]),

        text(" button on the "),

        dropdown("tabs.close.location", [
          { name: "right", value: "right" },
          { name: "left",  value: "left"  }
        ]),

        text(" side "),

        dropdown("tabs.close.display", [
          { name: "while hovering", value: "hover" },
          //o.item("of the focused tab", "focused") TODO
          { name: "of every tab",   value: "every" }
        ])
      ]),

      separator(),

      header("When a tab is clicked..."),
      indent([
        radio("tabs.click.type", [{
          name: "1 click to focus",
          value: "focus"
        }, {
          name: "1 click to select, 2 clicks to focus",
          value: "select-focus"
        }])
      ]),

      separator(),

      header("When a duplicate tab is opened..."),
      indent([
        radio("tabs.duplicates.behavior", [{
          name: "Do nothing",
          value: "nothing"
        }, {
          name: "Close the old tab",
          value: "close-old-tab"
        }, {
          name: "Close the old tab and merge it into the new tab",
          value: "close-merge-old-tab"
        }])
      ])
    ]);


  return async.done({ ui });
});
