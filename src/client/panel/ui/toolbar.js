import { always } from "../../../util/mutable/ref";
import { search as ui_search } from "./search";
import * as dom from "../../dom";


const color = dom.hsl(211, 100, 45, 0.75); // 100, 45, 0.75

const style_toolbar = dom.style({
  // TODO is this correct ?
  "height": always("23px"),
  "border-width": always("2px"),
  "border-radius": always("4px"),
  "background-color": always(dom.hsl(0, 0, 100, 1)),
  // TODO is this correct ?
  "z-index": always("3"),

  "border-color": always(color),
  "box-shadow": always(      "0px 0px 8px 1px " + color + "," +
                       "inset 0px 0px 3px 0px " + color)
});


export const toolbar = () =>
  dom.row((e) => [
    e.set_style(style_toolbar, always(true)),

    e.children([
      ui_search()
    ])
  ]);
