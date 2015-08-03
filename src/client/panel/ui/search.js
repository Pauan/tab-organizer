import { always } from "../../../util/mutable/ref";
import { change_search } from "../search/search";
import * as dom from "../../dom";


const style_search = dom.style({
  "padding-top": always("1px"),
  "padding-bottom": always("2px"),
  "padding-left": always("2px"),
  "padding-right": always("2px"),

  "height": always("100%"),
});


export const search = () =>
  dom.search((e) => [
    e.set_style(dom.stretch, always(true)),
    e.set_style(style_search, always(true)),

    e.on_change((value) => {
      change_search(value);
    })
  ]);
