import * as dom from "../../dom";
import { always } from "../../../util/ref";
import { async } from "../../../util/async";
import { init as init_theme } from "./categories/theme";
import { init as init_groups } from "./categories/groups";
import { init as init_tabs } from "./categories/tabs";
import { init as init_counter } from "./categories/counter";


export const init = async([init_theme,
                           init_groups,
                           init_tabs,
                           init_counter],
                          ({ ui: ui_theme },
                           { ui: ui_groups },
                           { ui: ui_tabs },
                           { ui: ui_counter }) => {

  const style_top = dom.style({
    // TODO code duplication
    "font-family": always("sans-serif"),
    "font-size": always("13px"),
    "width": always("100%"),
    "height": always("100%"),

    //"white-space": always("pre-wrap"),

    "padding-top": always("29px"),
    "padding-right": always("45px"),

    "background-attachment": always("fixed"),
    "background-color": always(dom.hsl(211, 13, 35)),

    "background-image": always(dom.gradient("to bottom",
                                 ["0%",   "transparent"],
                                 ["100%", dom.hsl(0, 0, 0, 0.1)]) + "," +
                               dom.repeating_gradient("0deg",
                                 ["0px", "transparent"],
                                 ["2px", dom.hsl(0, 0, 0, 0.05)],
                                 ["3px", dom.hsl(0, 0, 0, 0.05)])),
  });

  const style_inner = dom.style({
    "margin-left": always("auto"),
    "margin-right": always("auto")
  });

  const inner = () =>
    dom.parent((e) => [
      e.set_style(style_inner, always(true)),

      e.children([
        ui_theme(),
        ui_groups(),
        ui_tabs(),
        ui_counter()
      ])
    ]);

  const top = () =>
    dom.parent((e) => [
      e.set_style(dom.col, always(true)),
      e.set_style(style_top, always(true)),

      e.children([
        inner()
      ])
    ]);


  return { top };
});
