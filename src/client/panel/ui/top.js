import { always } from "../../../util/mutable/ref";
import { group_list as ui_group_list } from "./group-list";
import { toolbar as ui_toolbar } from "./toolbar";
import * as dom from "../../dom";


export const top = (group_list) =>
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
