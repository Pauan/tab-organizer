import { always } from "../../../util/mutable/ref";
import { search as ui_search } from "./search";
import * as dom from "../../dom";


export const toolbar = () =>
  dom.row((e) => [
    /*e.style({
      "height": always("20px")
    }),*/

    e.children([
      ui_search()
    ])
  ]);
