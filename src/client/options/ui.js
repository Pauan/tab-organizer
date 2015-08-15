import * as dom from "../dom";
import { manifest } from "../../chrome/client";
import { always } from "../../util/mutable/ref";
import { async } from "../../util/async";
import { init as init_top } from "./ui/top";


dom.title(always(manifest.get("name") + " - Options"));


// TODO this can probably be moved into "options.js"
export const init = async([init_top], ({ top: ui_top }) => {
  dom.main(ui_top());
});
