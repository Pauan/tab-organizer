import * as dom from "../../dom";
import { async } from "../../../util/async";
import { always } from "../../../util/mutable/ref";
import { init as init_group_list } from "./group-list";
import { toolbar as ui_toolbar } from "./toolbar";


export const init = async(function* () {
  const { group_list: ui_group_list } = yield init_group_list;


  const style_top = dom.style({
    "width": always("100%"),
    "height": always("100%"),

    "font-family": always("sans-serif"),
    "font-size": always("13px"),

    "background-color": always("white"),
    "background-image": always(dom.repeating_gradient("0deg",
                                 ["0px", "transparent"],
                                 ["2px", dom.hsl(200, 30, 30, 0.022)],
                                 ["3px", dom.hsl(200, 30, 30, 0.022)])),
  });


  const top = (group_list) =>
    dom.col((e) => [
      e.set_style(style_top, always(true)),

      e.children([
        ui_toolbar(),
        ui_group_list(group_list)
      ])
    ]);


  return { top };
});
