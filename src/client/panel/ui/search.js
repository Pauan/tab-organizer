import { always } from "../../../util/mutable/ref";
import { value } from "../search/search";
import * as dom from "../../dom";


const style_search = dom.style({
  "cursor": always("auto"),

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

    // TODO a little hacky
    e.value(always(value.get())),

    e.on_change((x) => {
      value.set(x);
    })
  ]);
