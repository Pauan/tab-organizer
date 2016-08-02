import * as dom from "../../../util/dom";
import * as async from "../../../util/async";
import * as mutable from "../../../util/mutable";
import { on_crash } from "../../../util/assert";
import { value } from "../search/search";
import { top_inset } from "./common";
import { init as init_dragging } from "../logic/dragging";


const failed = mutable.make(null);

on_crash((e) => {
  mutable.set(failed, e);
});


export const init = async.all([init_dragging],
                              ({ dragging_started }) => {

  const style_search = dom.make_style({
    "cursor": mutable.map(dragging_started, (x) =>
                (x === null ? "auto" : null)),

    "padding-top": mutable.always("1px"),
    "padding-bottom": mutable.always("2px"),
    "padding-left": mutable.always("2px"),
    "padding-right": mutable.always("2px"),

    "height": mutable.always("100%"),

    "background-color": mutable.map_null(failed, (failed) => dom.hsl(5, 100, 90)),

    "box-shadow": mutable.always("inset 0px 0px 1px 0px " + top_inset)
  });


  const search = () =>
    dom.search((e) => [
      dom.add_style(e, dom.stretch),
      dom.add_style(e, style_search),

      // TODO this isn't quite correct
      dom.set_tooltip(e, mutable.map_null(failed, (failed) => failed["message"])),

      // TODO a little hacky
      // TODO is this correct ?
      dom.set_value(e, mutable.first(value)),

      dom.on_change(e, (x) => {
        mutable.set(value, x);
      })
    ]);


  return async.done({ search });
});
