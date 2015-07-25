import { always } from "../../../util/mutable/ref";
import { group as ui_group } from "./group";
import * as dom from "../../dom";


const style_group_list = dom.style({
  "align-items": "stretch", // TODO hacky
  "height": "100%"
});


export const group_list = (groups) =>
  dom.row((e) => [
    e.style(style_group_list, always(true)),

    e.children(groups.map(ui_group))
  ]);
