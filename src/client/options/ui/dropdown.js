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
      if (child.children) {
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

  const dropdown = (name, children) => {
    const ref = get(name);
    const def = get_default(name);

    const values = get_values(children);

    return dom.select((e) => [
      e.set_style(style_dropdown, always(true)),
      e.set_style(style_changed, ref.map((x) => x !== def)),

      e.tooltip(always("Default: " + values.get(def))),

      // TODO a little hacky
      e.children(always(map(children, ({ dom }) => dom))),

      e.value(ref),

      e.on_change((value) => {
        // TODO this causes the DOM node to be updated twice
        ref.set(value);
      })
    ]);
  };

  const group = (name, children) => {
    return {
      children,
      dom: dom.optgroup((e) => [
        e.label(always(name)),
        // TODO a little hacky
        e.children(always(map(children, ({ dom }) => dom)))
      ])
    };
  };

  const item = ({ value, name }) => {
    return {
      value,
      name,
      dom: dom.option((e) => [
        e.value(always(value)),
        e.label(always(name))
      ])
    };
  };


  return { dropdown, group, item };
});
