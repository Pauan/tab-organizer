import * as dom from "../../../util/dom";
import * as async from "../../../util/async";
import * as mutable from "../../../util/mutable";
import { style_changed, style_icon } from "./common";
import { init as init_options } from "../../sync/options";


export const init = async.all([init_options],
                              ({ get, get_default }) => {

  const style_wrapper = dom.make_style({
    "display": mutable.always("inline-block"),
    "margin-top": mutable.always("1px"),
    "margin-bottom": mutable.always("1px")
  });

  const style_label = dom.make_style({
    "cursor": mutable.always("pointer"),
    "padding": mutable.always("1px 4px"),
    "border-width": mutable.always("1px"),
    "border-radius": mutable.always("5px"),
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
          dom.toggle_style(e, style_changed, mutable.map(opt, (x) => x !== def)),

          dom.set_tooltip(e, mutable.always("Default: " + def)),

          dom.children(e, [
            dom.checkbox((e) => [
              dom.add_style(e, style_icon),

              dom.toggle_checked(e, opt),

              dom.on_change(e, (checked) => {
                // TODO this causes the DOM node to be updated twice
                mutable.set(opt, checked);
              })
            ]),

            dom.text((e) => [
              dom.set_value(e, mutable.always(text))
            ])
          ])
        ])
      ])
    ])
  };


  return async.done({ checkbox });
});
