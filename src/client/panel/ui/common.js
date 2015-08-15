import * as dom from "../../dom";
import { always } from "../../../util/ref";


export const style_texture = dom.style({
  "background-image": always(dom.repeating_gradient("0deg",
                               ["0px", "transparent"],
                               ["2px", dom.hsl(200, 30, 30, 0.022)],
                               ["3px", dom.hsl(200, 30, 30, 0.022)])),
});
