import * as async from "../../../../util/async";
import { category, header, indent } from "../common";
import { init as init_checkbox } from "../checkbox";


export const init = async.all([init_checkbox],
                              ({ checkbox }) => {

  const ui = () =>
    category("Button", [
      header("Show the number of tabs which are..."),
      indent([
        checkbox("counter.display.loaded", "Active"),
        checkbox("counter.display.unloaded", "Inactive")
      ])
    ]);


  return async.done({ ui });
});
