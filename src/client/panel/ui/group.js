import * as dom from "../../dom";
import { async } from "../../../util/async";
import { always, and, latest } from "../../../util/mutable/ref";
import { init as init_tab } from "./tab";
import { init as init_options } from "../../sync/options";
import { init as init_logic } from "../logic";


export const init = async(function* () {
  const { tab: ui_tab } = yield init_tab;
  const { get: opt } = yield init_options;
  const logic = yield init_logic;


  const animation_group_wrapper = dom.animation({
    easing: always("ease-in-out"),
    // TODO a tiny bit hacky
    duration: opt("theme.animation").map((x) => (x ? "500ms" : "0ms")),
    from: {
      "width": opt("groups.layout").map((x) => {
        switch (x) {
        case "horizontal":
        case "grid":
          return "0px";
        default:
          return null;
        }
      }),

      "height": opt("groups.layout").map((x) => {
        switch (x) {
        case "grid":
          return "0px";
        default:
          return null;
        }
      }),

      "opacity": always("0")
    }
  });

  const animation_group = dom.animation({
    easing: always("ease-in-out"),
    // TODO a tiny bit hacky
    duration: opt("theme.animation").map((x) => (x ? "500ms" : "0ms")),
    from: {
      // TODO what about "grid" ?
      "border-width": opt("groups.layout").map((x) => {
        switch (x) {
        case "horizontal":
          // TODO a little hacky
          return "1px 0px 1px 0px";
        default:
          return null;
        }
      }),

      // TODO what about "grid" ?
      "padding": opt("groups.layout").map((x) => {
        switch (x) {
        case "horizontal":
          // TODO a little hacky
          return "1px 0px 0px 0px";
        default:
          return null;
        }
      }),

      "width": opt("groups.layout").map((x) => {
        switch (x) {
        case "horizontal":
          return "0px";
        default:
          return null;
        }
      }),
    }
  });

  const animation_group_header = dom.animation({
    easing: always("ease-in-out"),
    // TODO a little hacky
    duration: opt("theme.animation").map((x) => (x ? "500ms" : "0ms")),
    from: {
      "height": opt("groups.layout").map((x) => {
        switch (x) {
        case "vertical":
          return "0px";
        default:
          return null;
        }
      }),

      // This needs to match the "margin-left" in "tab.js"
      "margin-left": always("12px"),
    }
  });

  const animation_group_tabs = dom.animation({
    easing: always("ease-in-out"),
    // TODO a little hacky
    duration: opt("theme.animation").map((x) => (x ? "500ms" : "0ms")),
    from: {
      // TODO what about "grid" ?
      "padding-bottom": opt("groups.layout").map((x) => {
        switch (x) {
        case "vertical":
          return "0px";
        default:
          return null;
        }
      }),
    }
  });


  const style_group_wrapper = dom.style({
    "overflow": always("visible"),

    "float": opt("groups.layout").map((x) => {
      switch (x) {
      case "grid":
        return "left";
      default:
        return null;
      }
    }),

    "width": latest([
      opt("groups.layout"),
      opt("groups.layout.grid.column")
    ], (layout, col) => {
      switch (layout) {
      case "horizontal":
        // This is the minimum width for the group
        return "110px";

      case "grid":
        return ((1 / col) * 100) + "%";

      default:
        return null;
      }
    }),

    "height": latest([
      opt("groups.layout"),
      opt("groups.layout.grid.row")
    ], (layout, row) => {
      switch (layout) {
      case "grid":
        return ((1 / row) * 100) + "%";

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
      case "grid":
        return "1px";
      case "vertical":
        return "1px 0px 0px 0px";
      default:
        return null;
      }
    }),

    "margin": opt("groups.layout").map((x) => {
      switch (x) {
      case "grid":
        return "-1px 0px 0px -1px";
      default:
        return null;
      }
    }),

    "border-color": opt("groups.layout").map((x) => {
      switch (x) {
      case "horizontal":
        return dom.hsl(211, 50, 65) + " " +
               dom.hsl(211, 50, 50) + " " +
               dom.hsl(211, 50, 45) + " " +
               dom.hsl(211, 50, 60);
      case "vertical":
        return dom.hsl(211, 50, 75);
      default:
        return dom.hsl(211, 50, 65);
      }
    }),

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
    // This is needed so that drag-and-drop works correctly (i.e. "height")
    "box-sizing": always("content-box"),

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

    // TODO test if using "padding-bottom" rather than "margin-bottom" messes up tab drag-and-drop
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

      e.on_mouse_hover((hover) => {
        if (hover && !hover.subtree) {
          logic.drag_onto_group(group);
        }
      }),

      e.children(group.get("tabs").map((x) => ui_tab(group, x)))
    ]);

  const group = (group) =>
    dom.parent((e) => [
      // TODO is this needed ?
      e.set_style(dom.col, always(true)),
      e.set_style(style_group_wrapper, always(true)),

      e.visible(group.get("visible")),

      e.animate(animation_group_wrapper, {
        insert: "play-to",
        remove: "play-from",
      }),

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
