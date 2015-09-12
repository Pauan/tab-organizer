import * as dom from "../../dom";
import * as async from "../../../util/async";
import * as ref from "../../../util/ref";
import { style_changed, style_icon } from "./common";
import { init as init_options } from "../../sync/options";


export const init = async.all([init_options],
                              ({ get, get_default }) => {

  const style_wrapper = dom.make_style({
    "display": ref.always("inline-block"),
    "margin-top": ref.always("1px"),
    "margin-bottom": ref.always("1px")
  });

  const style_label = dom.make_style({
    "cursor": ref.always("pointer"),
    "padding": ref.always("1px 4px"),
    "border-width": ref.always("1px"),
    "border-radius": ref.always("5px"),
  });

  const checkbox = (name, text) => {
    const opt = get(name);
    const def = get_default(name);

    return dom.parent((e) => [
      dom.add_style(e, style_wrapper),

      dom.children(e, [
        dom.label((e) => [
          dom.add_style(e, dom.row),
          dom.add_style(e, style_label),
          dom.toggle_style(e, style_changed, ref.map(opt, (x) => x !== def)),

          dom.tooltip(e, ref.always("Default: " + def)),

          dom.children(e, [
            dom.checkbox((e) => [
              dom.add_style(e, style_icon),

              dom.checked(e, opt),

              dom.on_change(e, (checked) => {
                // TODO this causes the DOM node to be updated twice
                ref.set(opt, checked);
              })
            ]),

            dom.text((e) => [
              dom.value(e, ref.always(text))
            ])
          ])
        ])
      ])
    ])
  };


  return async.done({ checkbox });
});
