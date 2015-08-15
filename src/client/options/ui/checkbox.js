import * as dom from "../../dom";
import { always } from "../../../util/mutable/ref";
import { async } from "../../../util/async";
import { init as init_options } from "../../sync/options";


export const init = async([init_options],
                          ({ get, get_default }) => {

  const style_label = dom.style({
    "cursor": always("pointer"),
    "padding": always("1px 3px"),
    "border-width": always("1px"),
    "border-radius": always("5px"),
    "margin-top": always("1px"),
    "margin-bottom": always("1px")
  });

  // TODO code duplication with radio
  const style_checkbox = dom.style({
    "top": always("1px"),
    "margin-right": always("3px")
  });

  const style_changed = dom.style({
    "border-color":     always(dom.hsl(0, 50, 60)),
    "background-color": always(dom.hsl(0, 50, 96))
  });

  const checkbox = (name, text) => {
    const ref = get(name);
    const def = get_default(name);

    return dom.label((e) => [
      e.set_style(dom.row, always(true)),
      e.set_style(style_label, always(true)),
      e.set_style(style_changed, ref.map((x) => x !== def)),

      e.tooltip(always("Default: " + def)),

      e.children([
        dom.checkbox((e) => [
          e.set_style(style_checkbox, always(true)),

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
    ]);
  };


  return { checkbox };
});
