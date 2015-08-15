import * as dom from "../../dom";
import { always } from "../../../util/ref";


export const top_inset = dom.hsl(211, 95, 70);

export const top_shadow = dom.hsl(211, 95, 45);

export const style_texture = dom.style({
  "background-image": always(dom.repeating_gradient("0deg",
                               ["0px", "transparent"],
                               ["2px", dom.hsl(200, 30, 30, 0.022)],
                               ["3px", dom.hsl(200, 30, 30, 0.022)])),
});
