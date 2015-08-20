import * as dom from "../../dom";
import { always, Ref } from "../../../util/ref";
import { async } from "../../../util/async";
import { style_changed, style_icon,
         style_textbox, style_invalid } from "./common";
import { init as init_options } from "../../sync/options";


export const init = async([init_options], (options) => {

  const textbox = (name, { width = "3em",
                           type = "text",
                           // TODO
                           get_value = (x) => x,
                           set_value = (x) => x }) => {

    const ref = options.get(name);
    const def = options.get_default(name);

    const invalid = new Ref(false);

    return dom.textbox((e) => [
      e.set_style(style_textbox, always(true)),
      e.set_style(style_changed, ref.map((x) => x !== def)),
      e.set_style(style_invalid, invalid),

      e.style({
        "width": always(width)
      }),

      e.tooltip(always("Default: " + get_value(def))),

      e.value(ref.map(get_value)),

      e.on_change((value) => {
        // TODO this isn't quite right
        if (value === "") {
          invalid.set(false);
          ref.set(def);


        } else if (type === "number") {
          value = +value;

          console.log(value);

          // TODO better test for this ?
          if (isNaN(value)) {
            invalid.set(true);

          } else {
            invalid.set(false);
            ref.set(set_value(value));
          }


        } else {
          invalid.set(false);
          ref.set(set_value(value));
        }
      })
    ])
  };


  return { textbox };
});
