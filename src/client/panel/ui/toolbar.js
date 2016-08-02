import * as dom from "../../../util/dom";
import * as async from "../../../util/async";
import * as mutable from "../../../util/mutable";
import { top_inset, top_shadow } from "./common";
import { init as init_search } from "./search";
import { init as init_options } from "../../sync/options";
import { init as init_dragging } from "../logic/dragging";


export const init = async.all([init_search,
                               init_options,
                               init_dragging],
                              ({ search: ui_search },
                               { get: opt },
                               { dragging_started }) => {

  const style_toolbar = dom.make_style({
    "margin": mutable.map(opt("groups.layout"), (x) => {
      switch (x) {
      case "horizontal":
      case "grid":
        return "0px 7px 0px 7px";
      default:
        return "0px 2px 0px 2px";
      }
    }),

    // TODO is this correct ?
    "height": mutable.always("24px"),
    "background-color": mutable.always(dom.hsl(0, 0, 100)),
    // TODO is this correct ?
    "z-index": mutable.always("3"),

    "border-radius": mutable.always("2px"),
    "border-width": mutable.always("1px"),
    "border-color": mutable.always(dom.hsl(0, 0, 50) + " " +
                               dom.hsl(0, 0, 40) + " " +
                               dom.hsl(0, 0, 40) + " " +
                               dom.hsl(0, 0, 50)),

    "box-shadow": mutable.always("0px 1px 3px 0px " + top_shadow),
  });

  const style_menu = dom.make_style({
    "height": mutable.always("100%"),
    "padding-left": mutable.always("12px"),
    "padding-right": mutable.always("12px"),

    "cursor": mutable.map(dragging_started, (x) =>
                (x === null ? "pointer" : null)),

    "box-shadow": mutable.always("inset 0px 0px 1px 0px " + top_inset)
  });

  const style_menu_hold = dom.make_style({
    "padding-top": mutable.always("1px")
  });


  const separator = (color) =>
    dom.child((e) => [
      dom.style(e, {
        "background-color": mutable.always(color),
        "width": mutable.always("1px"),
        "height": mutable.always("100%"),
      })
    ]);


  const toolbar = () =>
    dom.parent((e) => [
      dom.add_style(e, dom.row),
      dom.add_style(e, style_toolbar),

      dom.children(e, [
        ui_search(),

        separator(dom.hsl(0, 0, 45)),

        dom.parent((e) => {
          const hovering = mutable.make(null);
          const holding  = mutable.make(null);

          return [
            dom.add_style(e, dom.row),
            dom.add_style(e, style_menu),

            dom.toggle_style(e, style_menu_hold, mutable.and([
              hovering,
              holding
            ])),

            dom.on_mouse_hover(e, (hover) => {
              mutable.set(hovering, hover);
            }),

            dom.on_mouse_hold(e, (hold) => {
              mutable.set(holding, hold);
            }),

            // TODO a little hacky
            dom.children(e, [
              dom.text((e) => [
                dom.set_value(e, mutable.always("Menu"))
              ])
            ])
          ];
        })
      ])
    ]);


  return async.done({ toolbar });
});
