import { init as init_chrome } from "../chrome/server";
import { async } from "../util/async";


export const init = async(function* () {
  const { manifest, button } = yield init_chrome;

  button.set_tooltip(manifest.get("name"));

  button.set_bubble_url("panel.html");
});
