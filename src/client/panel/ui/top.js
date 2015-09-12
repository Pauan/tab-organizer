import * as dom from "../../dom";
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
