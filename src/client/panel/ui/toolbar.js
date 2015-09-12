import * as dom from "../../dom";
import * as async from "../../../util/async";
import * as ref from "../../../util/ref";
import { top_inset, top_shadow } from "./common";
import { search as ui_search } from "./search";
import { init as init_options } from "../../sync/options";


export const init = async.all([init_options], ({ get: opt }) => {

  const style_toolbar = dom.make_style({
    "margin": ref.map(opt("groups.layout"), (x) => {
      switch (x) {
      case "horizontal":
      case "grid":
        return "0px 7px 0px 7px";
      default:
        return "0px 2px 0px 2px";
      }
    }),

    // TODO is this correct ?
    "height": ref.always("24px"),
    "background-color": ref.always(dom.hsl(0, 0, 100)),
    // TODO is this correct ?
    "z-index": ref.always("3"),

    "border-radius": ref.always("2px"),
    "border-width": ref.always("1px"),
    "border-color": ref.always(dom.hsl(0, 0, 50) + " " +
                               dom.hsl(0, 0, 40) + " " +
                               dom.hsl(0, 0, 40) + " " +
                               dom.hsl(0, 0, 50)),

    "box-shadow": ref.always("0px 1px 3px 0px " + top_shadow),
  });

  const style_menu = dom.make_style({
    "height": ref.always("100%"),
    "padding-left": ref.always("12px"),
    "padding-right": ref.always("12px"),
    "cursor": ref.always("pointer"),

    "box-shadow": ref.always("inset 0px 0px 1px 0px " + top_inset)
  });

  const style_menu_hold = dom.make_style({
    "padding-top": ref.always("1px")
  });


  const separator = (color) =>
    dom.child((e) => [
      dom.style(e, {
        "background-color": ref.always(color),
        "width": ref.always("1px"),
        "height": ref.always("100%"),
      })
    ]);


  const toolbar = () =>
    dom.parent((e) => [
      dom.add_style(e, dom.row),
      dom.add_style(e, style_toolbar),

      dom.children(e, [
        ui_search(),

        separator(dom.hsl(0, 0, 45)),

        dom.parent((e) => [
          dom.add_style(e, dom.row),
          dom.add_style(e, style_menu),

          dom.toggle_style(e, style_menu_hold, ref.and([
            dom.hovering(e),
            dom.holding(e)
          ])),

          // TODO a little hacky
          dom.children(e, [
            dom.text((e) => [
              dom.set_value(e, ref.always("Menu"))
            ])
          ])
        ])
      ])
    ]);


  return async.done({ toolbar });
});
