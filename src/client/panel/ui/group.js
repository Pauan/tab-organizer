import * as dom from "../../dom";
import * as logic from "../logic";
import { async } from "../../../util/async";
import { always } from "../../../util/mutable/ref";
import { init as init_tab } from "./tab";
import { init as init_options } from "../../sync/options";


export const init = async(function* () {
  const { tab: ui_tab } = yield init_tab;
  const { get: opt } = yield init_options;


  // TODO code duplication
  const animation_group = dom.animation({
    easing: "ease-in-out",
    duration: "500ms",
    from: {
      //"top": always("0px"),
      "border-top-width": always("0px"),
      "padding-top": always("0px"),
      "padding-bottom": always("0px"),
      "opacity": always("0"),
    }
  });

  const animation_group_header = dom.animation({
    easing: "ease-in-out",
    duration: "500ms",
    from: {
      "height": always("0px"),
      "margin-left": always("20px"),
    }
  });

  const animation_group_tabs = dom.animation({
    easing: "ease-in-out",
    duration: "500ms",
    from: {
      "padding-bottom": always("0px"),
      //"height": always("0px")
    }
  });


  const style_group = dom.style({
    //"width": always("300px"),
    //"height": always("100%"),

    "border-top-width": always("1px"),
    "border-color": always(dom.hsl(211, 50, 75)),

    /*"border-image-source": always(dom.gradient("to right",
                                               ["0%", "transparent"],
                                               ["5%", dom.hsl(211, 50, 75)],
                                               ["95%", dom.hsl(211, 50, 75)],
                                               ["100%", "transparent"])),
    "border-image-slice": always("100% 0%"),*/

    //"border-color": always(dom.hsl(211, 50, 75)),

    "top": always("-1px"),
    "padding": always("1px"),
  });

  const style_group_header = dom.style({
    // TODO is this correct ?
    "height": always("18px"),
    //"padding-top": always("1px"), // TODO this needs to be animated
    "padding-left": always("4px")
  });

  const style_group_text = dom.style({
    "font-size": always("11px")
  });

  const style_group_tabs = dom.style({
    // Magical incantation to make it much smoother
    //"transform": always("translate3d(0px, 0px, 0px"),

    //"transition": always("height 1000ms ease-in-out"),
    //"overflow-y": always("auto"),
    //"height": "100%"
    "padding-bottom": always("2px"),
  });

  const group_header = (group) =>
    dom.row((e) => [
      e.set_style(style_group_header, always(true)),

      e.animate(animation_group_header, {
        insert: "play-to",
        remove: "play-from",
      }),

      e.children([
        dom.text((e) => [
          e.set_style(dom.stretch, always(true)),
          e.set_style(style_group_text, always(true)),

          e.value(group.get("name"))
        ])
      ])
    ]);

  const group_tabs = (group) =>
    dom.col((e) => [
      e.set_style(dom.stretch, always(true)),
      e.set_style(style_group_tabs, always(true)),

      e.animate(animation_group_tabs, {
        insert: "play-to",
        remove: "play-from",
      }),

      e.style({
        "height": group.get("height")
      }),

      // TODO
      /*e.on_mouse_hover((hover) => {
        if (hover) {
          logic.drag_onto_group(group);
        }
      }),*/

      e.children(group.get("tabs").map((x) => ui_tab(group, x)))
    ]);

  const group = (group) =>
    dom.col((e) => [
      e.set_style(style_group, always(true)),

      e.visible(group.get("matches")),

      e.animate(animation_group, {
        insert: "play-to",
        remove: "play-from",
      }),

      e.children([
        group_header(group),
        group_tabs(group)
      ])
    ]);


  return { group };
});
