import { always } from "../../../util/mutable/ref";
import * as dom from "../../dom";


export const toolbar = () =>
  dom.row((e) => [
    e.style({
      "height": always("20px")
    })
  ]);
