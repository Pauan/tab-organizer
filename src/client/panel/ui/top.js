import * as dom from "../../../util/dom";
import * as async from "../../../util/async";
import * as mutable from "../../../util/mutable";
import { style_texture } from "./common";
import { init as init_group_list } from "./group-list";
import { init as init_options } from "../../sync/options";
import { init as init_toolbar } from "./toolbar";
import { init as init_groups } from "../logic/groups";
import { is_panel } from "../init";


export const init = async.all([init_group_list,
                               init_options,
                               init_toolbar,
                               init_groups],
                              ({ group_list: ui_group_list },
                               { get: opt },
                               { toolbar: ui_toolbar },
                               { groups }) => {

  // Styling for the scrollbar
  dom.make_stylesheet("::-webkit-scrollbar", {
    "width": mutable.always("12px"),
    "height": mutable.always("12px"),
    "overflow": mutable.always("visible")
  });

  dom.make_stylesheet("::-webkit-scrollbar-track", {
    "border": mutable.always("1px solid"),
    "border-color": mutable.always(dom.hsl(0, 0, 97)),
    "background-color": mutable.always(dom.hsl(0, 0, 96)),

    "box-shadow": mutable.always("inset 0px 0px 0px 1px " + dom.hsl(0, 0, 95)),

    "margin-top": mutable.map(opt("groups.layout"), (x) => {
      switch (x) {
      case "vertical":
        return "4px";
      default:
        return null;
      }
    }),

    "overflow": mutable.always("visible"),
    "border-radius": mutable.always("5px")
  });

  dom.make_stylesheet("::-webkit-scrollbar-thumb", {
    "min-width": mutable.always("36px"), // 3 * 12
    "min-height": mutable.always("36px"), // 3 * 12

    "border": mutable.always("2px solid"),
    "border-color": mutable.always(dom.hsl(0, 0, 97)),
    "background-color": mutable.always(dom.hsl(0, 0, 80)),

    "box-shadow": mutable.always("inset 0px 0px 0px 1px " + dom.hsl(0, 0, 60) + "," +
                             "inset 0px 0px 0px 2px " + dom.hsl(0, 0, 85)),

    "overflow": mutable.always("visible"),
    "border-radius": mutable.always("5px")
  });

  dom.make_stylesheet("::-webkit-scrollbar-thumb:hover", {
    "background-color": mutable.always(dom.hsl(0, 0, 70)),

    "box-shadow": mutable.always("inset 0px 0px 0px 1px " + dom.hsl(0, 0, 50) + "," +
                             "inset 0px 0px 0px 2px " + dom.hsl(0, 0, 79)),
  });


  const style_top = dom.make_style({
    "font-family": mutable.always("sans-serif"),
    "font-size": mutable.always("13px"),

    "padding": mutable.map(opt("groups.layout"), (x) => {
      switch (x) {
      case "horizontal":
      case "grid":
        return "5px 0px 0px 0px";
      default:
        return "2px 0px 0px 0px";
      }
    }),

    "background-color": mutable.map(opt("groups.layout"), (x) => {
      switch (x) {
      case "horizontal":
      case "grid":
        return dom.hsl(0, 0, 98);
      default:
        return dom.hsl(0, 0, 100);
      }
    }),

    /*"background-image": mutable.always(dom.gradient("to bottom",
                                     ["0%", "transparent"],
                                     ["3px", dom.hsl(0, 0, 0, 0.1)],
                                     // TODO this needs to be matched with the height of the search bar
                                     // TODO what about the height in horizontal mode ?
                                     ["25px", dom.hsl(0, 0, 0, 0.1)],
                                     ["30px", "transparent"],
                                     ["100%", "transparent"])),*/

    "width": mutable.always("100%"),
    "height": mutable.always("100%"),
  });


  // TODO a bit hacky
  if (is_panel && mutable.get(opt("popup.type")) === "bubble") {
    document["body"]["style"]["width"] =
      mutable.get(opt("size.bubble.width")) + "px";

    document["body"]["style"]["height"] =
      mutable.get(opt("size.bubble.height")) + "px";
  }


  const top = () =>
    dom.parent((e) => [
      dom.add_style(e, style_top),
      dom.add_style(e, style_texture),

      dom.children(e, [
        ui_toolbar(),
        // TODO handle `groups` changing
        ui_group_list(mutable.get(groups))
      ])
    ]);


  return async.done({ top });
});
