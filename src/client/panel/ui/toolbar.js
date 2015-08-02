import { always } from "../../../util/mutable/ref";
import { search as ui_search } from "./search";
import * as dom from "../../dom";


const color = dom.hsl(211, 100, 45, 0.75); // 100, 45, 0.75

const style_toolbar = dom.style({
  // TODO is this correct ?
  "height": always("25px"),
  "background-color": always(dom.hsl(0, 0, 100, 1)),
  // TODO is this correct ?
  "z-index": always("3"),

  "border-color": always(color),
  "border-bottom-width": always("1px"),
  //"border-bottom-left-radius": always("1px"),
  //"border-bottom-right-radius": always("1px"),

  /*"background-image": always(dom.gradient("to right",
                                          ["0%", "transparent"],
                                          ["0%", color],
                                          ["100%", color],
                                          ["100%", "transparent"])),
  "background-size": always("100% 1px"),
  "background-position": always("0px 100%"),*/

  "box-shadow": always("0px 0px 6px 0px " + color)
});


export const toolbar = () =>
  dom.row((e) => [
    e.set_style(style_toolbar, always(true)),

    e.children([
      ui_search()
    ])
  ]);
