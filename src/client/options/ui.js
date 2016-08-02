import * as dom from "../../util/dom";
import * as async from "../../util/async";
import * as record from "../../util/record";
import * as mutable from "../../util/mutable";
import { manifest } from "../../chrome/client";
import { init as init_top } from "./ui/top";
import "../styles";


dom.set_title(mutable.always(record.get(manifest, "name") + " - Options"));


// TODO this can probably be moved into "options.js"
export const init = async.all([init_top],
                              ({ top: ui_top }) => {

  dom.push_root(ui_top());

  return async.done({});
});
