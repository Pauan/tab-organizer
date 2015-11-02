import * as dom from "../../../util/dom";
import * as async from "../../../util/async";
import * as ref from "../../../util/ref";
import { style_texture } from "./common";
import { init as init_group_list } from "./group-list";
import { init as init_options } from "../../sync/options";
import { init as init_toolbar } from "./toolbar";
import { init as init_logic } from "../logic";
import { is_panel } from "../init";


export const init = async.all([init_group_list,
                               init_options,
                               init_toolbar,
                               init_logic],
                              ({ group_list: ui_group_list },
                               { get: opt },
                               { toolbar: ui_toolbar },
                               { group_type }) => {

  // Styling for the scrollbar
  dom.make_stylesheet("::-webkit-scrollbar", {
    "width": ref.always("12px"),
    "height": ref.always("12px"),
    "overflow": ref.always("visible")
  });

  dom.make_stylesheet("::-webkit-scrollbar-track", {
    "border": ref.always("1px solid"),
    "border-color": ref.always(dom.hsl(0, 0, 97)),
    "background-color": ref.always(dom.hsl(0, 0, 96)),

    "box-shadow": ref.always("inset 0px 0px 0px 1px " + dom.hsl(0, 0, 95)),

    "margin-top": ref.map(opt("groups.layout"), (x) => {
      switch (x) {
      case "vertical":
        return "4px";
      default:
        return null;
      }
    }),

    "overflow": ref.always("visible"),
    "border-radius": ref.always("5px")
  });

  dom.make_stylesheet("::-webkit-scrollbar-thumb", {
    "min-width": ref.always("36px"), // 3 * 12
    "min-height": ref.always("36px"), // 3 * 12

    "border": ref.always("2px solid"),
    "border-color": ref.always(dom.hsl(0, 0, 97)),
    "background-color": ref.always(dom.hsl(0, 0, 80)),

    "box-shadow": ref.always("inset 0px 0px 0px 1px " + dom.hsl(0, 0, 60) + "," +
                             "inset 0px 0px 0px 2px " + dom.hsl(0, 0, 85)),

    "overflow": ref.always("visible"),
    "border-radius": ref.always("5px")
  });

  dom.make_stylesheet("::-webkit-scrollbar-thumb:hover", {
    "background-color": ref.always(dom.hsl(0, 0, 70)),

    "box-shadow": ref.always("inset 0px 0px 0px 1px " + dom.hsl(0, 0, 50) + "," +
                             "inset 0px 0px 0px 2px " + dom.hsl(0, 0, 79)),
  });


  const style_top = dom.make_style({
    "font-family": ref.always("sans-serif"),
    "font-size": ref.always("13px"),

    "padding": ref.map(opt("groups.layout"), (x) => {
      switch (x) {
      case "horizontal":
      case "grid":
        return "5px 0px 0px 0px";
      default:
        return "2px 0px 0px 0px";
      }
    }),

    "background-color": ref.map(opt("groups.layout"), (x) => {
      switch (x) {
      case "horizontal":
      case "grid":
        return dom.hsl(0, 0, 98);
      default:
        return dom.hsl(0, 0, 100);
      }
    }),

    /*"background-image": ref.always(dom.gradient("to bottom",
                                     ["0%", "transparent"],
                                     ["3px", dom.hsl(0, 0, 0, 0.1)],
                                     // TODO this needs to be matched with the height of the search bar
                                     // TODO what about the height in horizontal mode ?
                                     ["25px", dom.hsl(0, 0, 0, 0.1)],
                                     ["30px", "transparent"],
                                     ["100%", "transparent"])),*/

    "width": ref.always("100%"),
    "height": ref.always("100%"),
  });


  // TODO a bit hacky
  if (is_panel && ref.get(opt("popup.type")) === "bubble") {
    document["body"]["style"]["width"] =
      ref.get(opt("size.bubble.width")) + "px";

    document["body"]["style"]["height"] =
      ref.get(opt("size.bubble.height")) + "px";
  }


  const top = () =>
    dom.parent((e) => [
      dom.add_style(e, style_top),
      dom.add_style(e, style_texture),

      dom.children(e, [
        ui_toolbar(),
        // TODO handle `group_type` changing
        ui_group_list(ref.get(group_type).groups)
      ])
    ]);


  return async.done({ top });
});
