import * as dom from "../../dom";
import { async } from "../../../util/async";
import { always } from "../../../util/mutable/ref";
import { init as init_group_list } from "./group-list";
import { toolbar as ui_toolbar } from "./toolbar";


export const init = async(function* () {
  const { group_list: ui_group_list } = yield init_group_list;


  const top = (group_list) =>
    dom.col((e) => [
      e.style({
        "width": always("100%"),
        "height": always("100%")
      }),

      e.children([
        ui_toolbar(),
        ui_group_list(group_list)
      ])
    ]);


  return { top };
});
