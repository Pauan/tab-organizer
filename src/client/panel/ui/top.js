import * as dom from "../../dom";
import { async } from "../../../util/async";
import { always, latest } from "../../../util/mutable/ref";
import { init as init_group_list } from "./group-list";
import { init as init_options } from "../../sync/options";
import { init as init_toolbar } from "./toolbar";
import { init as init_logic } from "../logic";


export const init = async(function* () {
  const { group_list: ui_group_list } = yield init_group_list;
  const { get: opt } = yield init_options;
  const { toolbar: ui_toolbar } = yield init_toolbar;
  const { group_type } = yield init_logic;


  const style_top = dom.style({
    "font-family": always("sans-serif"),
    "font-size": always("13px"),

    "background-color": always("white"),
    "background-image": always(dom.repeating_gradient("0deg",
                                 ["0px", "transparent"],
                                 ["2px", dom.hsl(200, 30, 30, 0.022)],
                                 ["3px", dom.hsl(200, 30, 30, 0.022)])),

    "width": always("100%"),
    "height": always("100%"),
  });


  const top = () =>
    dom.parent((e) => [
      e.set_style(dom.col, always(true)),
      e.set_style(style_top, always(true)),

      e.children([
        ui_toolbar(),
        // TODO handle `group_type` changing
        ui_group_list(group_type.get().groups)
      ]),


      // TODO a bit hacky
      // TODO test this
      latest([
        opt("popup.type"),
        opt("size.bubble.width")
      ], (type, width) => {
        // TODO seems unreliable
        if (type === "bubble"/* && window["outerWidth"] < (width / 2)*/) {
          return width + "px";
        } else {
          return null;
        }
      }).each((x) => {
        document["body"]["style"]["width"] = x;
      }),

      // TODO a bit hacky
      // TODO test this
      latest([
        opt("popup.type"),
        opt("size.bubble.height")
      ], (type, height) => {
        // TODO seems unreliable
        if (type === "bubble"/* && window["outerHeight"] < (height / 2)*/) {
          return height + "px";
        } else {
          return null;
        }
      }).each((x) => {
        document["body"]["style"]["height"] = x;
      })
    ]);


  return { top };
});
