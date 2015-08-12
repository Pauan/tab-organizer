import * as dom from "../../../dom";
import { always } from "../../../../util/mutable/ref";
import { async } from "../../../../util/async";
import { category } from "../category";
import { separator } from "../separator";
import { init as init_checkbox } from "../checkbox";
import { init as init_dropdown } from "../dropdown";


export const init = async(function* () {
  const { checkbox } = yield init_checkbox;
  const { dropdown, group, item } = yield init_dropdown;


  const color = () =>
    dom.parent((e) => [
      e.set_style(dom.row, always(true)),

      e.children([
        dom.text((e) => [
          e.value(always("Color... "))
        ]),

        dropdown("theme.color", [
          group("Color", [
            item({ name: "Blue",   value: "blue"   }),
            item({ name: "Green",  value: "green"  }),
            item({ name: "Yellow", value: "yellow" }),
            item({ name: "Orange", value: "orange" }),
            item({ name: "Red",    value: "red"    }),
            item({ name: "Purple", value: "purple" }),
            item({ name: "Pink",   value: "pink"   }),
          ]),
          group("Grayscale", [
            item({ name: "Black", value: "black" }),
            item({ name: "Grey",  value: "grey"  }),
            item({ name: "White", value: "white" })
          ])
        ])
      ])
    ]);

  const ui = () =>
    category("THEME", [
      checkbox("theme.animation", "Animation enabled"),

      separator(),

      color()
    ]);


  return { ui };
});
