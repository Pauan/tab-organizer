import * as dom from "../../../dom";
import { async } from "../../../../util/async";
import { category, header, indent } from "../common";
import { init as init_checkbox } from "../checkbox";


export const init = async([init_checkbox],
                          ({ checkbox }) => {

  const ui = () =>
    category("Counter", [
      header("Display a counter that shows how many tabs you have..."),
      indent([
        checkbox("counter.display.loaded", "Loaded in Chrome"),
        checkbox("counter.display.unloaded", "Unloaded in Chrome")
      ])
    ]);


  return { ui };
});
