import * as dom from "../../dom";
import { map, each } from "../../../util/iterator";
import { Record } from "../../../util/mutable/record";
import { always } from "../../../util/mutable/ref";
import { async } from "../../../util/async";
import { init as init_options } from "../../sync/options";


export const init = async([init_options],
                          ({ get, get_default }) => {

  const style_dropdown = dom.style({
    "height": always("20px"),
    // TODO replace with dom.hsl
    "box-shadow": always("0px 0px 5px lightgray"),
    "padding-left": always("1px"),
    /* margin-top: -2px; */
    /* top: -2px; */
    "text-shadow": always("0px 1px 0px white"),
    "background-color": always(dom.hsl(211, 75, 99)),

    "background-image": always(dom.gradient("to bottom",
                                 ["0%", "transparent"],
                                 ["20%", dom.hsl(0, 0, 0, 0.04)],
                                 ["70%", dom.hsl(0, 0, 0, 0.05)],
                                 ["100%", dom.hsl(0, 0, 0, 0.1)])),

    "border-width": always("1px"),
    "border-radius": always("3px"),
    "border-color": always(dom.hsl(0, 0, 65) + " " +
                           dom.hsl(0, 0, 55) + " " +
                           dom.hsl(0, 0, 55) + " " +
                           dom.hsl(0, 0, 65)),
  });

  // TODO code duplication
  const style_changed = dom.style({
    "border-color":     always(dom.hsl(0, 50, 60)),
    "background-color": always(dom.hsl(0, 50, 96))
  });

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
      e.set_children(always(map(children, ({ dom }) => dom))),

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
        e.set_children(always(map(children, ({ dom }) => dom)))
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
