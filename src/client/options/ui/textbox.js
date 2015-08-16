import * as dom from "../../dom";
import { always, Ref } from "../../../util/ref";
import { async } from "../../../util/async";
import { style_changed, style_icon,
         style_textbox, style_invalid } from "./common";
import { init as init_options } from "../../sync/options";


export const init = async([init_options],
                          ({ get, get_default }) => {

  const textbox = (name, { width = "3em", type = "text" }) => {
    const ref = get(name);
    const def = get_default(name);

    const invalid = new Ref(false);

    return dom.textbox((e) => [
      e.set_style(style_textbox, always(true)),
      e.set_style(style_changed, ref.map((x) => x !== def)),
      e.set_style(style_invalid, invalid),

      e.style({
        "width": always(width)
      }),

      e.tooltip(always("Default: " + def)),

      e.value(ref),

      e.on_change((value) => {
        if (type === "number") {
          value = +value;

          console.log(value);

          // TODO better test for this ?
          if (isNaN(value)) {
            invalid.set(true);

          } else {
            invalid.set(false);
            ref.set(value);
          }

        } else {
          invalid.set(false);
          ref.set(value);
        }
      })
    ])
  };


  return { textbox };
});
