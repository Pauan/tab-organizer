import * as dom from "../../dom";
import * as async from "../../../util/async";
import * as ref from "../../../util/ref";
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

    const invalid = ref.make(false);

    return dom.textbox((e) => [
      dom.add_style(e, style_textbox),
      dom.toggle_style(e, style_changed, ref.map(opt, (x) => x !== def)),
      dom.toggle_style(e, style_invalid, invalid),

      dom.style(e, {
        "width": ref.always(width)
      }),

      dom.set_tooltip(e, ref.always("Default: " + get_value(def))),

      dom.set_value(e, ref.map(opt, get_value)),

      dom.on_change(e, (value) => {
        // TODO this isn't quite right
        if (value === "") {
          ref.set(invalid, false);
          ref.set(opt, def);


        } else if (type === "number") {
          value = +value;

          // TODO better test for this ?
          if (isNaN(value)) {
            ref.set(invalid, true);

          } else {
            ref.set(invalid, false);
            ref.set(opt, set_value(value));
          }


        } else {
          ref.set(invalid, false);
          ref.set(opt, set_value(value));
        }
      })
    ])
  };


  return async.done({ textbox });
});
