import * as dom from "../../dom";
import { always } from "../../../util/mutable/ref";
import { async } from "../../../util/async";


export const init = async(function* () {
  const style_top = dom.style({
    /*"font-family": always("sans-serif"),
    "font-size": always("13px"),

    "background-color": always("white"),

    "background-image": always(dom.repeating_gradient("0deg",
                                 ["0px", "transparent"],
                                 ["2px", dom.hsl(200, 30, 30, 0.022)],
                                 ["3px", dom.hsl(200, 30, 30, 0.022)])),

    "width": always("100%"),
    "height": always("100%"),*/
  });


  const top = () =>
    dom.parent((e) => [
      e.set_style(dom.col, always(true)),
      e.set_style(style_top, always(true))
    ]);


  return { top };
});
