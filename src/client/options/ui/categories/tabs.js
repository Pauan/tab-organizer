import * as dom from "../../../dom";
import { always } from "../../../../util/ref";
import { async } from "../../../../util/async";
import { category, header, indent,
         row, text, separator } from "../common";
import { init as init_radio } from "../radio";
import { init as init_checkbox } from "../checkbox";
import { init as init_dropdown } from "../dropdown";


export const init = async([init_radio,
                           init_checkbox,
                           init_dropdown],
                          ({ radio },
                           { checkbox },
                           { dropdown }) => {

  const ui = () =>
    category("Tabs", [
      row([
        text("Sort tabs by... "),

        dropdown("group.sort.type", [
          { name: "Window",  value: "window"  },
          { name: "Tag",     value: "tag"     },
          { separator: true },
          { name: "Focused", value: "focused" },
          { name: "Created", value: "created" },
          { separator: true },
          { name: "URL",     value: "url"     },
          { name: "Name",    value: "title"   }
        ])
      ]),

      separator(),

      row([
        text("Show the "),

        dom.image((e) => [
          e.alt(always("close")),
          e.tooltip(always("close")),
          e.url(always("data/images/button-close.png"))
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


  return { ui };
});
