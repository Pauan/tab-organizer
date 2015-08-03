import { always } from "../../../util/mutable/ref";
import { search as ui_search } from "./search";
import * as dom from "../../dom";


const color = dom.hsl(211, 100, 45, 0.2); // 211, 100, 45, 0.75

const style_toolbar = dom.style({
  "margin-top": always("1px"),
  "margin-left": always("1px"),
  "margin-right": always("1px"),

  // TODO is this correct ?
  "height": always("28px"),
  "background-color": always(dom.hsl(0, 0, 100, 1)),
  // TODO is this correct ?
  "z-index": always("3"),
  //"padding-bottom": always("1px"),

  "border-radius": always("3px"),
  "border-width": always("1px"),

  //"border-bottom-width": always("1px"),
  "border-color": always(dom.hsl(211, 100, 45)),

  /*"background-image": always(dom.gradient("to bottom",
                                          ["0%", "transparent"],
                                          ["90%", "transparent"],
                                          ["100%", color])),*/

  /*"background-image": always(dom.gradient("to right",
                                          ["0%", color],
                                          ["1%", dom.hsl(211, 100, 45, 0.75)],
                                          ["99%", dom.hsl(211, 100, 45, 0.75)],
                                          ["100%", color])),*/
  /*"border-image-source": always(dom.gradient("to right",
                                             ["0%", color],
                                             ["1%", dom.hsl(211, 100, 45, 0.3)],
                                             ["99%", dom.hsl(211, 100, 45, 0.3)],
                                             ["100%", color])),
  "border-image-slice": always("100% 0%"),*/
  /*"background-position": always("0px calc(100% - 1px), 0px 100%"),
  "background-size": always("100% 1px, 100% 1px"),*/

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
  "box-shadow": always("0px 2px 0px -1px " + dom.hsl(211, 100, 45, 0.5) + "," +
                       "0px 4px 1px -2px " + dom.hsl(211, 100, 45, 0.4) + "," +
                       "0px 7px 1px -4px " + dom.hsl(211, 100, 45, 0.3) + "," +
                       "inset 0px 0px 5px 0px " + dom.hsl(211, 100, 45, 0.2) + "," +
                       "inset 0px -1px 1px 0px " + dom.hsl(211, 100, 45, 0.1)),
});


export const toolbar = () =>
  dom.row((e) => [
    e.set_style(style_toolbar, always(true)),

    e.children([
      ui_search()
    ])
  ]);
