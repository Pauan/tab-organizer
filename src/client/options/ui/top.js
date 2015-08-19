import * as dom from "../../dom";
import { always } from "../../../util/ref";
import { async } from "../../../util/async";
import { init as init_theme } from "./categories/theme";
import { init as init_groups } from "./categories/groups";
import { init as init_tabs } from "./categories/tabs";
import { init as init_popup } from "./categories/popup";
import { init as init_counter } from "./categories/counter";
import { init as init_user_data } from "./categories/user data";


export const init = async([init_theme,
                           init_groups,
                           init_tabs,
                           init_popup,
                           init_counter,
                           init_user_data],
                          ({ ui: ui_theme },
                           { ui: ui_groups },
                           { ui: ui_tabs },
                           { ui: ui_popup },
                           { ui: ui_counter },
                           { ui: ui_user_data }) => {

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

    "overflow": always("auto"),
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
        ui_popup(),
        ui_counter(),
        ui_user_data()
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
