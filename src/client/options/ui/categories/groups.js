import * as dom from "../../../dom";
import { async } from "../../../../util/async";
import { category, header, indent,
         row, text, vertical_space } from "../common";
import { init as init_radio } from "../radio";
import { init as init_textbox } from "../textbox";


export const init = async([init_radio,
                           init_textbox],
                          ({ radio },
                           { textbox }) => {

  const ui = () =>
    category("Groups", [
      header("Display groups..."),
      vertical_space("2px"),
      indent([
        radio("groups.layout", [
          { name: "Vertically",   value: "vertical"   },
          { name: "Horizontally", value: "horizontal" },
          { name: "In a grid",    value: "grid"       }
        ]),

        vertical_space("2px"),

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


  return { ui };
});
