import * as dom from "../../dom";
import * as logic from "../logic";
import { async } from "../../../util/async";
import { always, and } from "../../../util/mutable/ref";
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


  const style_group_wrapper = dom.style({
    "overflow": always("visible"),

    "width": opt("groups.layout").map((x) => {
      switch (x) {
      case "horizontal":
        return "110px";
      default:
        return null;
      }
    }),

    // TODO hacky
    "background": always("inherit"),
  });

  const style_group = dom.style({
    "width": opt("groups.layout").map((x) => {
      switch (x) {
      case "horizontal":
        return "300px";
      default:
        return null;
      }
    }),

    "box-shadow": opt("groups.layout").map((x) => {
      switch (x) {
      case "horizontal":
        return "-2px 0px 5px -2px " + dom.hsl(0, 0, 50, 0.7) + "," +
               "1px 1px 1px 0px " + dom.hsl(0, 0, 50, 0.7);
      default:
        return null;
      }
    }),

    "border-width": opt("groups.layout").map((x) => {
      switch (x) {
      case "horizontal":
        return "1px";
      case "vertical":
        return "1px 0px 0px 0px";
      default:
        return null;
      }
    }),

    "border-color": always(dom.hsl(211, 50, 75)),

    /*"border-image-source": always(dom.gradient("to right",
                                               ["0%", "transparent"],
                                               ["5%", dom.hsl(211, 50, 75)],
                                               ["95%", dom.hsl(211, 50, 75)],
                                               ["100%", "transparent"])),
    "border-image-slice": always("100% 0%"),*/

    //"border-color": always(dom.hsl(211, 50, 75)),

    // TODO hacky
    "background": always("inherit"),

    "top": opt("groups.layout").map((x) => {
      switch (x) {
      case "vertical":
        return "-1px";
      default:
        return null;
      }
    }),

    "padding-top": always("1px"),
    "padding-left": always("1px"),
    "padding-right": always("1px"),
  });

  const style_group_focused = dom.style({
    "z-index": always("2"),

    "box-shadow": always("0px 0px 1px 3px " + dom.hsl(211, 80, 50)),
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
    "overflow-y": opt("groups.layout").map((x) => {
      switch (x) {
      case "horizontal":
      case "grid":
        return "auto";
      default:
        return null;
      }
    }),

    //"height": "100%"
    "padding-bottom": always("3px"),
  });

  const group_header = (group) =>
    dom.parent((e) => [
      e.set_style(dom.row, always(true)),
      e.set_style(style_group_header, always(true)),

      e.animate(animation_group_header, {
        insert: "play-to",
        remove: "play-from",
      }),

      e.children([
        dom.text((e) => [
          e.set_style(dom.stretch, always(true)),
          e.set_style(style_group_text, always(true)),

          e.value(group.get("header-name"))
        ])
      ])
    ]);

  const group_tabs = (group) =>
    dom.parent((e) => [
      e.set_style(dom.col, always(true)),
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
    dom.parent((e) => [
      // TODO is this needed ?
      e.set_style(dom.col, always(true)),
      e.set_style(style_group_wrapper, always(true)),

      e.visible(group.get("matches")),

      e.children([
        dom.parent((e) => [
          e.set_style(dom.col, always(true)),
          // TODO is this needed ?
          e.set_style(dom.stretch, always(true)),
          e.set_style(style_group, always(true)),

          e.set_style(style_group_focused, and([
            group.get("focused"),
            opt("groups.layout").map((x) => x === "horizontal")
          ])),

          e.on_focus((focused) => {
            // TODO a little hacky, should be a part of logic
            group.get("focused").set(focused);
          }),

          e.animate(animation_group, {
            insert: "play-to",
            remove: "play-from",
          }),

          e.children([
            group_header(group),
            group_tabs(group)
          ])
        ])
      ])
    ]);


  return { group };
});
