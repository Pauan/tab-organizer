import * as dom from "../dom";
import * as record from "../../util/record";
import * as async from "../../util/async";
import * as ref from "../../util/ref";
import { manifest } from "../../chrome/client";
import { plural } from "../../util/string";
import { visible } from "./search/search";
import { init as init_top } from "./ui/top";
import "../styles";


dom.make_stylesheet("*", {
  "overflow": ref.always("hidden"),
});


const name = record.get(manifest, "name");

dom.set_title(ref.map(visible, ({ groups, tabs }) =>
                name + " - " +
                plural(tabs, " tab") + " in " +
                plural(groups, " group")));


// TODO this can probably be moved into "panel.js"
export const init = async.all([init_top], ({ top: ui_top }) => {

  dom.push_root(ui_top());

  return async.done({});
});
