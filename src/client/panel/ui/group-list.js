import * as dom from "../../dom";
import { async } from "../../../util/async";
import { always } from "../../../util/mutable/ref";
import { init as init_group } from "./group";


export const init = async(function* () {
  const { group: ui_group } = yield init_group;


  const style_group_list = dom.style({
    // TODO is this needed ?
    "white-space": always("pre"),

    "overflow": always("auto"),
    //"height": always("100%"),
    /*"align-items": always("stretch"), // TODO hacky
    "height": always("100%")*/

    "padding-top": always("3px")
  });


  const scroll_x = +(localStorage["popup.scroll.x"] || 0);
  const scroll_y = +(localStorage["popup.scroll.y"] || 0);


  const group_list = (groups) =>
    dom.col((e) => [
      e.set_style(dom.stretch, always(true)),
      e.set_style(style_group_list, always(true)),

      e.set_scroll({
        // TODO a little hacky
        x: always(scroll_x),
        // TODO a little hacky
        y: always(scroll_y)
      }),

      e.on_scroll(({ x, y }) => {
        localStorage["popup.scroll.x"] = "" + x;
        localStorage["popup.scroll.y"] = "" + y;
      }),

      // TODO a little bit hacky
      e.children([
        dom.col((e) => [
          e.children(groups.map(ui_group))
        ])
      ])
    ]);


  return { group_list };
});
