import * as dom from "../../../../util/dom";
import * as async from "../../../../util/async";
import * as mutable from "../../../../util/mutable";
import { category, separator, row, text } from "../common";
import { init as init_checkbox } from "../checkbox";
import { init as init_dropdown } from "../dropdown";


export const init = async.all([init_checkbox,
                               init_dropdown],
                              ({ checkbox },
                               { dropdown }) => {

  const style_preview = dom.make_style({
    "border-width": mutable.always("1px"),

    "border-color": mutable.always(dom.hsl(0, 0, 30) + " " +
                               dom.hsl(0, 0, 40) + " " +
                               dom.hsl(0, 0, 40) + " " +
                               dom.hsl(0, 0, 30)),

    "border-radius": mutable.always("4px"),
    "margin-top": mutable.always("0.4em"),
    "margin-bottom": mutable.always("7px"),
    "width": mutable.always("100%"),
    "height": mutable.always("200px")
  });

  const color = () =>
    row([
      text("Color... "),

      dropdown("theme.color", [{
        group: "Color",
        children: [
          { name: "Blue",   value: "blue"   },
          { name: "Green",  value: "green"  },
          { name: "Yellow", value: "yellow" },
          { name: "Orange", value: "orange" },
          { name: "Red",    value: "red"    },
          { name: "Purple", value: "purple" },
          { name: "Pink",   value: "pink"   },
        ]
      }, {
        group: "Grayscale",
        children: [
          { name: "Black", value: "black" },
          { name: "Grey",  value: "grey"  },
          { name: "White", value: "white" },
        ]
      }])
    ]);

  const ui = () =>
    category("Appearance", [
      checkbox("theme.animation", "Animation enabled"),

      separator(),

      color(),

      dom.iframe((e) => [
        dom.add_style(e, style_preview),
        dom.set_url(e, mutable.always("panel.html?options=true"))
      ])
    ]);


  return async.done({ ui });
});
