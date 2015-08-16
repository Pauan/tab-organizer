import * as dom from "../../../dom";
import { always } from "../../../../util/ref";
import { async } from "../../../../util/async";
import { category, header, indent,
         row, text, vertical_space } from "../common";
import { init as init_radio } from "../radio";
import { init as init_text } from "../text";


export const init = async([init_radio,
                           init_text],
                          ({ radio, item },
                           { number }) => {

  const ui = () =>
    category("GROUPS", [
      header("Display groups:"),
      indent([
        radio("groups.layout", [
          item({ name: "Vertically",   value: "vertical"   }),
          item({ name: "Horizontally", value: "horizontal" }),
          item({ name: "In a grid",    value: "grid"       })
        ]),

        vertical_space("2px"),

        indent([
          row([
            number("groups.layout.grid.column", {
              width: "2em"
            }),

            text("columns")
          ]),

          row([
            number("groups.layout.grid.row", {
              width: "2em"
            }),

            text("rows")
          ])
        ])
      ])
    ]);


  return { ui };
});
