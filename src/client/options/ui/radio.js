import * as dom from "../../../util/dom";
import * as list from "../../../util/list";
import * as async from "../../../util/async";
import * as ref from "../../../util/ref";
import * as record from "../../../util/record";
import { style_changed, style_icon } from "./common";
import { init as init_options } from "../../sync/options";


export const init = async.all([init_options],
                              ({ get, get_default }) => {

  const style_radio = dom.make_style({
    "display": ref.always("inline-block"),
    "border-width": ref.always("1px"),
    "border-radius": ref.always("5px"),
    "padding": ref.always("1px 0px"),
  });

  const style_label = dom.make_style({
    "cursor": ref.always("pointer"),
    "padding": ref.always("1px 4px"),
  });

  let radio_id = 0;

  const radio_item = (radio_name, opt, { name, value }) =>
    dom.label((e) => [
      dom.add_style(e, dom.row),
      dom.add_style(e, style_label),

      dom.children(e, [
        dom.radio((e) => [
          dom.add_style(e, style_icon),

          dom.set_name(e, ref.always(radio_name)),

          dom.toggle_checked(e, ref.map(opt, (x) => x === value)),

          dom.on_change(e, (checked) => {
            if (checked) {
              ref.set(opt, value);
            }
          })
        ]),

        dom.text((e) => [
          dom.set_value(e, ref.always(name))
        ])
      ])
    ]);

  // TODO code duplication with dropdown
  const radio = (name, items) => {
    const radio_name = "__radio" + (++radio_id);

    const opt = get(name);
    const def = get_default(name);

    const values = record.make();

    list.each(items, ({ name, value }) => {
      record.insert(values, value, name);
    });

    return dom.parent((e) => [
      dom.add_style(e, style_radio),
      dom.toggle_style(e, style_changed, ref.map(opt, (x) => x !== def)),

      dom.set_tooltip(e, ref.always("Default: " + record.get(values, def))),

      // TODO a little hacky
      dom.children(e, list.map(items, (x) => radio_item(radio_name, opt, x)))
    ]);
  };


  return async.done({ radio });
});
