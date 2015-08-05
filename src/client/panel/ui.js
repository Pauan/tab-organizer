import * as dom from "../dom";
import { async } from "../../util/async";
import { init as init_top } from "./ui/top";
import { init as init_logic } from "./logic";


export const init = async(function* () {
  const { top: ui_top } = yield init_top;
  const { group_type } = yield init_logic;

  // TODO handle `group_type` changing
  dom.main(ui_top(group_type.get().groups));
});
