import { always } from "../../../util/mutable/ref";
import { change_search } from "../search/search";
import * as dom from "../../dom";


const style_search = dom.style({
  "padding": always("1px 2px")
});


export const search = () =>
  dom.search((e) => [
    e.set_style(dom.stretch, always(true)),
    e.set_style(style_search, always(true)),

    e.on_change((value) => {
      change_search(value);
    })
  ]);
