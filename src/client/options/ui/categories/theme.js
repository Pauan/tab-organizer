import { async } from "../../../../util/async";
import { category } from "../category";
import { init as init_checkbox } from "../checkbox";


export const init = async(function* () {
  const { checkbox } = yield init_checkbox;


  const ui = () =>
    category("THEME", [
      checkbox("theme.animation", "Animation enabled")
    ]);


  return { ui };
});
