import * as dom from "../dom";
import { async } from "../../util/async";
import { init as init_top } from "./ui/top";


// TODO this can probably be moved into "panel.js"
export const init = async(function* () {
  const { top: ui_top } = yield init_top;

  dom.main(ui_top());
});
