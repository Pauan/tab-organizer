import * as dom from "../../dom";
import { always } from "../../../util/mutable/ref";
import { value } from "../search/search";
import { failed } from "../../../util/assert";


const style_search = dom.style({
  "cursor": always("auto"),

  "padding-top": always("1px"),
  "padding-bottom": always("2px"),
  "padding-left": always("2px"),
  "padding-right": always("2px"),

  "height": always("100%"),

  "background-color": failed.map_null((failed) => dom.hsl(5, 100, 90)),
});


export const search = () =>
  dom.search((e) => [
    e.set_style(dom.stretch, always(true)),
    e.set_style(style_search, always(true)),

    // TODO this isn't quite correct
    e.tooltip(failed.map_null((failed) => failed["message"])),

    // TODO a little hacky
    e.value(always(value.get())),

    e.on_change((x) => {
      value.set(x);
    })
  ]);
