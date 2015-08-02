import { always } from "../../../util/mutable/ref";
import { search as ui_search } from "./search";
import * as dom from "../../dom";


const color = dom.hsl(211, 100, 45, 0.2); // 211, 100, 45, 0.75

const style_toolbar = dom.style({
  // TODO is this correct ?
  "height": always("30px"),
  "background-color": always(dom.hsl(0, 0, 100, 1)),
  // TODO is this correct ?
  "z-index": always("3"),
  //"padding-bottom": always("1px"),

  //"border-bottom-left-radius": always("2px"),
  //"border-bottom-right-radius": always("2px"),

  "border-bottom-width": always("1px"),
  //"border-color": always(dom.hsl(211, 100, 45, 0.75)),

  /*"background-image": always(dom.gradient("to bottom",
                                          ["0%", "transparent"],
                                          ["90%", "transparent"],
                                          ["100%", color])),*/

  "border-image-source": always(dom.gradient("to right",
                                             ["0%", color],
                                             ["1%", dom.hsl(211, 100, 45, 0.75)],
                                             ["99%", dom.hsl(211, 100, 45, 0.75)],
                                             ["100%", color])),
  "border-image-slice": always("100% 0%"),

  /*"background-image": always(dom.gradient("to right",
                                          ["0%", "transparent"],
                                          ["33%", color],
                                          ["66%", color],
                                          ["100%", "transparent"])),*/
  /* dom.radial_gradient("ellipse",
                      ["0%", "transparent"],
                      ["99%", "transparent"],
                      ["100%", color]) */
  //"background-size": always("100% 1px"),
  //"background-position": always("0px 100%"),

  //"box-shadow": always("0px -10px 30px 0px " + color),
  "box-shadow": always("0px 0px 10px 3px " + color),
});


export const toolbar = () =>
  dom.row((e) => [
    e.set_style(style_toolbar, always(true)),

    e.children([
      ui_search()
    ])
  ]);
