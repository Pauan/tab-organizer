import { always } from "../../../util/mutable/ref";
import { group as ui_group } from "./group";
import * as dom from "../../dom";


const style_group_list = dom.style({
  "overflow": always("auto"),
  //"height": always("100%"),
  /*"align-items": always("stretch"), // TODO hacky
  "height": always("100%")*/
});


export const group_list = (groups) =>
  dom.col((e) => [
    e.set_style(dom.stretch, always(true)),
    e.set_style(style_group_list, always(true)),

    e.children(groups.map(ui_group))
  ]);
