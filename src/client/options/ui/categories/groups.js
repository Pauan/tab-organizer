import * as async from "../../../../util/async";
import { category, header, indent,
         row, text, separator } from "../common";
import { init as init_radio } from "../radio";
import { init as init_textbox } from "../textbox";
import { init as init_dropdown } from "../dropdown";


export const init = async.all([init_radio,
                               init_textbox,
                               init_dropdown],
                              ({ radio },
                               { textbox },
                               { dropdown }) => {

  const ui = () =>
    category("Groups", [
      row([
        text("Group tabs by... "),

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

      header("Display groups..."),
      indent([
        radio("groups.layout", [
          { name: "Vertically",   value: "vertical"   },
          { name: "Horizontally", value: "horizontal" },
          { name: "In a grid",    value: "grid"       }
        ]),

        indent([
          row([
            textbox("groups.layout.grid.column", {
              type: "number",
              width: "2em"
            }),

            text("columns")
          ]),

          row([
            textbox("groups.layout.grid.row", {
              type: "number",
              width: "2em"
            }),

            text("rows")
          ])
        ])
      ])
    ]);


  return async.done({ ui });
});
