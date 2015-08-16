import * as dom from "../../dom";
import { always } from "../../../util/ref";
import { async } from "../../../util/async";
import { style_changed, style_icon } from "./common";
import { init as init_options } from "../../sync/options";


export const init = async([init_options],
                          ({ get, get_default }) => {

  const style_wrapper = dom.style({
    "display": always("inline-block"),
    "margin-top": always("1px"),
    "margin-bottom": always("1px")
  });

  const style_label = dom.style({
    "cursor": always("pointer"),
    "padding": always("1px 4px"),
    "border-width": always("1px"),
    "border-radius": always("5px"),
  });

  const checkbox = (name, text) => {
    const ref = get(name);
    const def = get_default(name);

    return dom.parent((e) => [
      e.set_style(style_wrapper, always(true)),

      e.children([
        dom.label((e) => [
          e.set_style(dom.row, always(true)),
          e.set_style(style_label, always(true)),
          e.set_style(style_changed, ref.map((x) => x !== def)),

          e.tooltip(always("Default: " + def)),

          e.children([
            dom.checkbox((e) => [
              e.set_style(style_icon, always(true)),

              e.checked(ref),

              e.on_change((checked) => {
                // TODO this causes the DOM node to be updated twice
                ref.set(checked);
              })
            ]),

            dom.text((e) => [
              e.value(always(text))
            ])
          ])
        ])
      ])
    ])
  };


  return { checkbox };
});
