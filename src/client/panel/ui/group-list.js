import { always } from "../../../util/mutable/ref";
import { group as ui_group } from "./group";
import * as dom from "../../dom";


const style_group_list = dom.style({
  "align-items": always("stretch"), // TODO hacky
  "height": always("100%")
});


export const group_list = (groups) =>
  dom.row((e) => [
    e.set_style(style_group_list, always(true)),

    e.children(groups.map(ui_group))
  ]);
