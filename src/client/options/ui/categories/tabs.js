import * as dom from "../../../dom";
import { always } from "../../../../util/ref";
import { async } from "../../../../util/async";
import { category, header, indent,
         row, text } from "../common";
import { init as init_radio } from "../radio";
import { init as init_checkbox } from "../checkbox";
import { init as init_dropdown } from "../dropdown";


export const init = async([init_radio,
                           init_checkbox,
                           init_dropdown],
                          ({ radio },
                           { checkbox },
                           { dropdown, separator, item }) => {

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

      //separator(),
    ]);


  return { ui };
});
