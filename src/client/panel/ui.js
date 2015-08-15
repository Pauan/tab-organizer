import * as dom from "../dom";
import { manifest } from "../../chrome/client";
import { plural } from "../../util/string";
import { visible } from "./search/search";
import { async } from "../../util/async";
import { init as init_top } from "./ui/top";


const name = manifest.get("name");

dom.title(visible.map(({ groups, tabs }) =>
            name + " - " +
            plural(tabs, " tab") + " in " +
            plural(groups, " group")));


// TODO this can probably be moved into "panel.js"
export const init = async([init_top], ({ top: ui_top }) => {
  dom.main(ui_top());
});
