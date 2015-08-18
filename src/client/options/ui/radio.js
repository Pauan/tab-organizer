import * as dom from "../../dom";
import { map, each } from "../../../util/iterator";
import { Record } from "../../../util/mutable/record";
import { always } from "../../../util/ref";
import { async } from "../../../util/async";
import { style_changed, style_icon } from "./common";
import { init as init_options } from "../../sync/options";


export const init = async([init_options],
                          ({ get, get_default }) => {

  const style_radio = dom.style({
    "display": always("inline-block"),
    "border-width": always("1px"),
    "border-radius": always("5px"),
    "padding": always("1px 0px"),
  });

  const style_label = dom.style({
    "cursor": always("pointer"),
    "padding": always("1px 3px"),
  });

  let radio_id = 0;

  const radio_item = (radio_name, ref, { name, value }) =>
    dom.label((e) => [
      e.set_style(dom.row, always(true)),
      e.set_style(style_label, always(true)),

      e.children([
        dom.radio((e) => [
          e.set_style(style_icon, always(true)),

          e.name(always(radio_name)),

          e.checked(ref.map((x) => x === value)),

          e.on_change((checked) => {
            if (checked) {
              ref.set(value);
            }
          })
        ]),

        dom.text((e) => [
          e.value(always(name))
        ])
      ])
    ]);

  // TODO code duplication with dropdown
  const radio = (name, items) => {
    const radio_name = "__radio" + (++radio_id);

    const ref = get(name);
    const def = get_default(name);

    const values = new Record();

    each(items, ({ name, value }) => {
      values.insert(value, name);
    });

    return dom.parent((e) => [
      e.set_style(style_radio, always(true)),
      e.set_style(style_changed, ref.map((x) => x !== def)),

      e.tooltip(always("Default: " + values.get(def))),

      // TODO a little hacky
      e.children(always(map(items, (x) => radio_item(radio_name, ref, x))))
    ]);
  };


  return { radio };
});
