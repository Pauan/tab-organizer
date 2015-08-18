import * as dom from "../../../dom";
import { always } from "../../../../util/ref";
import { async } from "../../../../util/async";
import { category, separator, row, text } from "../common";
import { init as init_checkbox } from "../checkbox";
import { init as init_dropdown } from "../dropdown";


export const init = async([init_checkbox,
                           init_dropdown],
                          ({ checkbox },
                           { dropdown }) => {

  const style_preview = dom.style({
    "border-width": always("1px"),

    "border-color": always(dom.hsl(0, 0, 30) + " " +
                           dom.hsl(0, 0, 40) + " " +
                           dom.hsl(0, 0, 40) + " " +
                           dom.hsl(0, 0, 30)),

    "border-radius": always("4px"),
    "margin-top": always("0.4em"),
    "margin-bottom": always("7px"),
    "width": always("100%"),
    "height": always("200px")
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
    category("Theme", [
      checkbox("theme.animation", "Animation enabled"),

      separator(),

      color(),

      dom.iframe((e) => [
        e.set_style(style_preview, always(true)),
        e.url(always("panel.html?options=true"))
      ])
    ]);


  return { ui };
});
