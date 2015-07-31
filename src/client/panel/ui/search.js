import { always } from "../../../util/mutable/ref";
import * as logic from "../logic";
import * as dom from "../../dom";


export const search = () =>
  dom.search((e) => [
    e.set_style(dom.stretch, always(true)),

    e.on_change((value) => {
      logic.search(value);
    })
  ]);
