import * as dom from "../../../util/dom";
import * as async from "../../../util/async";
import * as mutable from "../../../util/mutable";
import * as functions from "../../../util/functions";
import { style_changed, style_icon,
         style_textbox, style_invalid } from "./common";
import { init as init_options } from "../../sync/options";


export const init = async.all([init_options], (options) => {

  const textbox = (name, { width = "3em",
                           type = "text",
                           get_value = functions.self,
                           set_value = functions.self }) => {

    const opt = options.get(name);
    const def = options.get_default(name);

    const invalid = mutable.make(false);

    return dom.textbox((e) => [
      dom.add_style(e, style_textbox),
      dom.toggle_style(e, style_changed, mutable.map(opt, (x) => x !== def)),
      dom.toggle_style(e, style_invalid, invalid),

      dom.style(e, {
        "width": mutable.always(width)
      }),

      dom.set_tooltip(e, mutable.always("Default: " + get_value(def))),

      dom.set_value(e, mutable.map(opt, get_value)),

      dom.on_change(e, (value) => {
        // TODO this isn't quite right
        if (value === "") {
          mutable.set(invalid, false);
          mutable.set(opt, def);


        } else if (type === "number") {
          value = +value;

          // TODO better test for this ?
          if (isNaN(value)) {
            mutable.set(invalid, true);

          } else {
            mutable.set(invalid, false);
            mutable.set(opt, set_value(value));
          }


        } else {
          mutable.set(invalid, false);
          mutable.set(opt, set_value(value));
        }
      })
    ])
  };


  return async.done({ textbox });
});
