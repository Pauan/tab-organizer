import * as dom from "../../dom";
import { async } from "../../../util/async";
import { always, latest } from "../../../util/ref";
import { style_texture } from "./common";
import { init as init_group_list } from "./group-list";
import { init as init_options } from "../../sync/options";
import { init as init_toolbar } from "./toolbar";
import { init as init_logic } from "../logic";
import { is_panel } from "../init";


export const init = async([init_group_list,
                           init_options,
                           init_toolbar,
                           init_logic],
                          ({ group_list: ui_group_list },
                           { get: opt },
                           { toolbar: ui_toolbar },
                           { group_type }) => {

  const style_top = dom.style({
    "font-family": always("sans-serif"),
    "font-size": always("13px"),

    "padding": opt("groups.layout").map((x) => {
      switch (x) {
      case "horizontal":
      case "grid":
        return "5px 0px 0px 0px";
      default:
        return "2px 0px 0px 0px";
      }
    }),

    "background-color": opt("groups.layout").map((x) => {
      switch (x) {
      case "horizontal":
      case "grid":
        return dom.hsl(0, 0, 98);
      default:
        return dom.hsl(0, 0, 100);
      }
    }),

    /*"background-image": always(dom.gradient("to bottom",
                                 ["0%", "transparent"],
                                 ["3px", dom.hsl(0, 0, 0, 0.1)],
                                 // TODO this needs to be matched with the height of the search bar
                                 // TODO what about the height in horizontal mode ?
                                 ["25px", dom.hsl(0, 0, 0, 0.1)],
                                 ["30px", "transparent"],
                                 ["100%", "transparent"])),*/

    "width": always("100%"),
    "height": always("100%"),
  });


  // TODO a bit hacky
  if (is_panel && opt("popup.type").get() === "bubble") {
    document["body"]["style"]["width"] =
      opt("size.bubble.width").get() + "px";

    document["body"]["style"]["height"] =
      opt("size.bubble.height").get() + "px";
  }


  const top = () =>
    dom.parent((e) => [
      e.set_style(style_top, always(true)),
      e.set_style(style_texture, always(true)),

      e.children([
        ui_toolbar(),
        // TODO handle `group_type` changing
        ui_group_list(group_type.get().groups)
      ])
    ]);


  return { top };
});
