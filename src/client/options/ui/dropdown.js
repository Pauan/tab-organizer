import * as dom from "../../dom";
import { map, each } from "../../../util/iterator";
import { Record } from "../../../util/mutable/record";
import { always } from "../../../util/ref";
import { async } from "../../../util/async";
import { style_changed, style_dropdown } from "./common";
import { init as init_options } from "../../sync/options";


export const init = async([init_options],
                          ({ get, get_default }) => {

  const get_values1 = (out, children) => {
    each(children, (child) => {
      if (child.separator) {
        // Do nothing

      } else if (child.group != null) {
        get_values1(out, child.children);

      } else {
        out.insert(child.value, child.name);
      }
    });
  };

  const get_values = (children) => {
    const out = new Record();
    get_values1(out, children);
    return out;
  };

  const dropdown_children = (children) =>
    // TODO a little hacky
    always(map(children, (info) =>
      (info.separator
        ? dom.optgroup((e) => [])
        : (info.group != null
            ? dom.optgroup((e) => [
                e.label(always(info.group)),
                e.children(dropdown_children(info.children))
              ])
            : dom.option((e) => [
                e.value(always(info.value)),
                e.label(always(info.name))
              ])))));

  const dropdown = (name, children) => {
    const ref = get(name);
    const def = get_default(name);

    const values = get_values(children);

    return dom.select((e) => [
      e.set_style(style_dropdown, always(true)),
      e.set_style(style_changed, ref.map((x) => x !== def)),

      e.tooltip(always("Default: " + values.get(def))),

      // TODO a little hacky
      e.children(dropdown_children(children)),

      e.value(ref),

      e.on_change((value) => {
        // TODO this causes the DOM node to be updated twice
        ref.set(value);
      })
    ]);
  };


  return { dropdown };
});
