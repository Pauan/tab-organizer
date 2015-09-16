import * as dom from "../../dom";
import * as async from "../../../util/async";
import * as stream from "../../../util/stream";
import * as record from "../../../util/record";
import * as ref from "../../../util/ref";
import { style_texture } from "./common";
import { init as init_tab } from "./tab";
import { init as init_options } from "../../sync/options";
import { init as init_logic } from "../logic";


export const init = async.all([init_tab,
                               init_options,
                               init_logic],
                              ({ tab: ui_tab },
                               { get: opt },
                               logic) => {

  const animation_group_wrapper = dom.make_animation({
    easing: ref.always("ease-in-out"),
    // TODO a tiny bit hacky
    duration: ref.map(opt("theme.animation"), (x) => (x ? "500ms" : "0ms")),
    from: {
      "width": ref.map(opt("groups.layout"), (x) => {
        switch (x) {
        case "horizontal":
        case "grid":
          return "0px";
        default:
          return null;
        }
      }),

      "height": ref.map(opt("groups.layout"), (x) => {
        switch (x) {
        case "grid":
          return "0px";
        default:
          return null;
        }
      }),

      "opacity": ref.always("0")
    }
  });

  const animation_group = dom.make_animation({
    easing: ref.always("ease-in-out"),
    // TODO a tiny bit hacky
    duration: ref.map(opt("theme.animation"), (x) => (x ? "500ms" : "0ms")),
    from: {
      "border-width": ref.map(opt("groups.layout"), (x) => {
        switch (x) {
        case "horizontal":
          // TODO a little hacky
          return "1px 0px 1px 0px";
        default:
          return null;
        }
      }),

      "padding": ref.map(opt("groups.layout"), (x) => {
        switch (x) {
        case "horizontal":
          // TODO a little hacky, this needs to match padding-top
          return "3px 0px 0px 0px";
        default:
          return null;
        }
      }),

      "width": ref.map(opt("groups.layout"), (x) => {
        switch (x) {
        case "horizontal":
          return "0px";
        default:
          return null;
        }
      }),
    }
  });

  const animation_group_header = dom.make_animation({
    easing: ref.always("ease-in-out"),
    // TODO a little hacky
    duration: ref.map(opt("theme.animation"), (x) => (x ? "500ms" : "0ms")),
    from: {
      "height": ref.map(opt("groups.layout"), (x) => {
        switch (x) {
        case "vertical":
          return "0px";
        default:
          return null;
        }
      }),

      // This needs to match the "margin-left" in "tab.js"
      "margin-left": ref.always("12px"),
    }
  });

  const animation_group_tabs = dom.make_animation({
    easing: ref.always("ease-in-out"),
    // TODO a little hacky
    duration: ref.map(opt("theme.animation"), (x) => (x ? "500ms" : "0ms")),
    from: {
      "padding-bottom": ref.map(opt("groups.layout"), (x) => {
        switch (x) {
        case "vertical":
          return "0px";
        default:
          return null;
        }
      }),
    }
  });


  const style_group_wrapper = dom.make_style({
    "overflow": ref.always("visible"),

    "float": ref.map(opt("groups.layout"), (x) => {
      switch (x) {
      case "grid":
        return "left";
      default:
        return null;
      }
    }),

    "width": ref.latest([
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

    "height": ref.latest([
      opt("groups.layout"),
      opt("groups.layout.grid.row")
    ], (layout, row) => {
      switch (layout) {
      case "horizontal":
        return "100%";

      case "grid":
        return ((1 / row) * 100) + "%";

      default:
        return null;
      }
    }),
  });

  const style_group = dom.make_style({
    "width": ref.map(opt("groups.layout"), (x) => {
      switch (x) {
      case "horizontal":
        return "300px";
      default:
        return null;
      }
    }),

    "height": ref.map(opt("groups.layout"), (x) => {
      switch (x) {
      case "horizontal":
        return "100%";
      case "grid":
        // TODO this is hacky, it needs to be kept in sync with the margins
        return "calc(100% - 6px)";
      default:
        return null;
      }
    }),

    "box-shadow": ref.map(opt("groups.layout"), (x) => {
      switch (x) {
      case "horizontal":
        return "-2px 0px 5px -2px " + dom.hsl(0, 0, 50, 0.7) + "," +
               "1px 1px 1px 0px " + dom.hsl(0, 0, 50, 0.7);
      case "grid":
        // TODO code duplication
        return "0px 0px 5px -2px " + dom.hsl(0, 0, 50, 0.7) + "," +
               "1px 1px 1px 0px " + dom.hsl(0, 0, 50, 0.7);
      default:
        return null;
      }
    }),

    "border-width": ref.map(opt("groups.layout"), (x) => {
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

    "margin": ref.map(opt("groups.layout"), (x) => {
      switch (x) {
      case "grid":
        return "3px";
      default:
        return null;
      }
    }),

    "border-color": ref.map(opt("groups.layout"), (x) => {
      switch (x) {
      case "horizontal":
      case "grid":
        return dom.hsl(211, 50, 65) + " " +
               dom.hsl(211, 50, 50) + " " +
               dom.hsl(211, 50, 45) + " " +
               dom.hsl(211, 50, 60);
      case "vertical":
        return dom.hsl(211, 50, 75);
      default:
        return null;
      }
    }),

    /*"border-image-source": ref.always(dom.gradient("to right",
                                                   ["0%", "transparent"],
                                                   ["5%", dom.hsl(211, 50, 75)],
                                                   ["95%", dom.hsl(211, 50, 75)],
                                                   ["100%", "transparent"])),
    "border-image-slice": ref.always("100% 0%"),*/

    //"border-color": ref.always(dom.hsl(211, 50, 75)),

    "top": ref.map(opt("groups.layout"), (x) => {
      switch (x) {
      case "vertical":
        return "-1px";
      default:
        return null;
      }
    }),

    "padding-top": ref.always("3px"),
    "padding-left": ref.always("1px"),
    "padding-right": ref.always("1px"),

    "background-color": ref.always(dom.hsl(0, 0, 100)),
  });

  const style_group_focused = dom.make_style({
    "z-index": ref.always("2"),

    "box-shadow": ref.always("0px 0px 4px 1px " + dom.hsl(211, 80, 50)),
  });

  const style_group_header = dom.make_style({
    // TODO is this correct ?
    "height": ref.always("16px"),
    //"padding-top": ref.always("1px"), // TODO this needs to be animated
    "padding-left": ref.always("4px")
  });

  const style_group_text = dom.make_style({
    "font-size": ref.always("11px")
  });

  const style_group_tabs = dom.make_style({
    // This is needed so that drag-and-drop works correctly (i.e. "height")
    "box-sizing": ref.always("content-box"),

    "height": ref.map(opt("groups.layout"), (x) => {
      switch (x) {
      case "horizontal":
      case "grid":
        // TODO this is hacky, it needs to be kept in sync with style_group_header and padding-bottom
        return "calc(100% - 16px - 3px)";
      default:
        return null;
      }
    }),

    //"transition": ref.always("height 1000ms ease-in-out"),
    "overflow-y": ref.map(opt("groups.layout"), (x) => {
      switch (x) {
      case "horizontal":
      case "grid":
        return "auto";
      default:
        return null;
      }
    }),

    // TODO test if using "padding-bottom" rather than "margin-bottom" messes up tab drag-and-drop
    "padding-bottom": ref.always("3px"),
  });

  const group_header = (group) =>
    dom.parent((e) => [
      dom.add_style(e, dom.row),
      dom.add_style(e, style_group_header),

      dom.animate(e, animation_group_header, {
        insert: "play-to",
        remove: "play-from",
      }),

      dom.children(e, [
        dom.text((e) => [
          dom.add_style(e, dom.stretch),
          dom.add_style(e, style_group_text),

          dom.set_value(e, record.get(group, "header-name"))
        ])
      ])
    ]);

  const group_tabs = (group) =>
    dom.parent((e) => [
      dom.add_style(e, dom.stretch),
      dom.add_style(e, style_group_tabs),

      dom.animate(e, animation_group_tabs, {
        insert: "play-to",
        remove: "play-from",
      }),

      dom.style(e, {
        "height": ref.latest([
          opt("groups.layout"),
          record.get(group, "height")
        ], (layout, height) => {
          switch (layout) {
          case "vertical":
            return height;
          default:
            return null;
          }
        })
      }),

      dom.on_mouse_hover(e, (hover) => {
        if (hover && !hover.subtree) {
          logic.drag_onto_group(group);
        }
      }),

      dom.stream(e, stream.map(record.get(group, "tabs"), (x) =>
                      ui_tab(group, x)))
    ]);

  const is_horizontal = ref.map(opt("groups.layout"), (x) =>
                          (x === "horizontal"));

  const group = (group) =>
    dom.parent((e) => [
      dom.add_style(e, style_group_wrapper),

      dom.toggle_visible(e, record.get(group, "visible")),

      dom.animate(e, animation_group_wrapper, {
        insert: "play-to",
        remove: "play-from",
      }),

      dom.children(e, [
        dom.parent((e) => [
          // TODO is this needed ?
          dom.add_style(e, dom.stretch),
          dom.add_style(e, style_group),
          dom.add_style(e, style_texture),

          dom.toggle_style(e, style_group_focused, ref.and([
            record.get(group, "selected"),
            is_horizontal
          ])),

          dom.on_focus(e, (focused) => {
            // TODO a little hacky, should be a part of logic
            ref.set(record.get(group, "selected"), focused);
          }),

          dom.animate(e, animation_group, {
            insert: "play-to",
            remove: "play-from",
          }),

          dom.children(e, [
            group_header(group),
            group_tabs(group)
          ])
        ])
      ])
    ]);


  return async.done({ group });
});
