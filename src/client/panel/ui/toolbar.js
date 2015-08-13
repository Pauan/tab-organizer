import * as dom from "../../dom";
import { async } from "../../../util/async";
import { always, and } from "../../../util/mutable/ref";
import { search as ui_search } from "./search";
import { init as init_options } from "../../sync/options";


export const init = async(function* () {
  const { get: opt } = yield init_options;


  const style_toolbar = dom.style({
    "margin": always("2px 2px 0px 2px"),

    // TODO is this correct ?
    "height": always("24px"),
    "background-color": always(dom.hsl(0, 0, 100)),
    // TODO is this correct ?
    "z-index": always("3"),

    "border-radius": always("2px"),
    "border-width": always("1px"),
    "border-color": always(dom.hsl(0, 0, 50) + " " +
                           dom.hsl(0, 0, 40) + " " +
                           dom.hsl(0, 0, 40) + " " +
                           dom.hsl(0, 0, 50)),

    "box-shadow": always("0px 1px 1px 0px " + dom.hsl(211, 100, 65) + "," +
                         "0px 1px 7px 0px " + dom.hsl(211, 100, 65)),
  });

  const style_menu = dom.style({
    "height": always("100%"),
    "padding-left": always("12px"),
    "padding-right": always("12px"),
    "cursor": always("pointer"),
  });

  const style_menu_hold = dom.style({
    "padding-top": always("1px")
  });


  const separator = (color) =>
    dom.child((e) => [
      e.style({
        "background-color": always(color),
        "width": always("1px"),
        "height": always("100%"),
      })
    ]);


  const toolbar = () =>
    dom.parent((e) => [
      e.set_style(dom.row, always(true)),
      e.set_style(style_toolbar, always(true)),

      e.children([
        ui_search(),

        separator(dom.hsl(211, 100, 45)),
        separator(dom.hsl(211, 100, 45, 0.1)),
        separator(dom.hsl(211, 100, 45)),

        dom.parent((e) => [
          e.set_style(dom.row, always(true)),
          e.set_style(style_menu, always(true)),

          e.set_style(style_menu_hold, and([
            e.hovering(),
            e.holding()
          ])),

          // TODO a little hacky
          e.children([
            dom.text((e) => [
              e.value(always("Menu"))
            ])
          ])
        ])
      ])
    ]);


  return { toolbar };
});
