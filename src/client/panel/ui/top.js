import * as dom from "../../dom";
import { async } from "../../../util/async";
import { always, latest } from "../../../util/mutable/ref";
import { style_texture } from "./common";
import { init as init_group_list } from "./group-list";
import { init as init_options } from "../../sync/options";
import { init as init_toolbar } from "./toolbar";
import { init as init_logic } from "../logic";


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


  const top = () =>
    dom.parent((e) => [
      e.set_style(style_top, always(true)),
      e.set_style(style_texture, always(true)),

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
