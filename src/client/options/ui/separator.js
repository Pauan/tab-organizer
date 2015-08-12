import * as dom from "../../dom";
import { always } from "../../../util/mutable/ref";


// TODO code duplication with category.js
const style_separator = dom.style({
  "height": always("1px"),
  "margin-top": always("0.5em"),
  "margin-bottom": always("calc(0.5em + 2px)"), // TODO a bit hacky
  "background-color": always(dom.hsl(0, 0, 93)),
  //"background-color": always(dom.hsl(0, 0, 0, 0.05)),
});

export const separator = () =>
  dom.child((e) => [
    e.set_style(style_separator, always(true))
  ]);
