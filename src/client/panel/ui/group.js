import { merge } from "../../../util/stream";
import * as dom from "../../dom";


const style_group = dom.style({
  "border": "5px solid black",
  // TODO
  "background-color": "white"
});

export const group = (group, init) =>
  dom.col((e) =>
    merge([
      e.style_always(style_group)
    ]));
