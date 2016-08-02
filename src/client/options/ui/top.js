import * as dom from "../../../util/dom";
import * as async from "../../../util/async";
import * as mutable from "../../../util/mutable";
import { init as init_appearance } from "./categories/appearance";
import { init as init_groups } from "./categories/groups";
import { init as init_tabs } from "./categories/tabs";
import { init as init_button } from "./categories/button";
import { init as init_keyboard } from "./categories/keyboard";
import { init as init_popup } from "./categories/popup";
import { init as init_user_data } from "./categories/user-data";


export const init = async.all([init_appearance,
                               init_groups,
                               init_tabs,
                               init_button,
                               init_keyboard,
                               init_popup,
                               init_user_data],
                              ({ ui: ui_appearance },
                               { ui: ui_groups },
                               { ui: ui_tabs },
                               { ui: ui_button },
                               { ui: ui_keyboard },
                               { ui: ui_popup },
                               { ui: ui_user_data }) => {

  const style_top = dom.make_style({
    // TODO hack which causes Chrome to not repaint when scrolling
    "transform": mutable.always("translateZ(0)"),

    // TODO code duplication
    "font-family": mutable.always("sans-serif"),
    "font-size": mutable.always("13px"),
    "width": mutable.always("100%"),
    "height": mutable.always("100%"),

    //"white-space": mutable.always("pre-wrap"),

    "padding-top": mutable.always("29px"),

    "background-color": mutable.always(dom.hsl(211, 13, 35)),

    "background-image": mutable.always(dom.gradient("to bottom",
                                     ["0%",   "transparent"],
                                     ["100%", dom.hsl(0, 0, 0, 0.1)]) + "," +
                                   dom.repeating_gradient("0deg",
                                     ["0px", "transparent"],
                                     ["2px", dom.hsl(0, 0, 0, 0.05)],
                                     ["3px", dom.hsl(0, 0, 0, 0.05)])),

    "overflow": mutable.always("auto"),
  });

  const style_inner = dom.make_style({
    "margin-left": mutable.always("auto"),
    "margin-right": mutable.always("auto")
  });

  const inner = () =>
    dom.parent((e) => [
      dom.add_style(e, style_inner),

      dom.children(e, [
        ui_appearance(),
        ui_groups(),
        ui_tabs(),
        ui_button(),
        ui_keyboard(),
        ui_popup(),
        ui_user_data()
      ])
    ]);

  const top = () =>
    dom.parent((e) => [
      dom.add_style(e, dom.col),
      dom.add_style(e, style_top),

      dom.children(e, [
        inner()
      ])
    ]);


  return async.done({ top });
});
