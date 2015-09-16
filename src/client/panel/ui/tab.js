import * as dom from "../../dom";
import * as list from "../../../util/list";
import * as record from "../../../util/record";
import * as stream from "../../../util/stream";
import * as async from "../../../util/async";
import * as ref from "../../../util/ref";
import { url_bar } from "./url-bar";
import { init as init_options } from "../../sync/options";
import { init as init_logic } from "../logic";


export const init = async.all([init_options,
                               init_logic],
                              ({ get: opt },
                               logic) => {

  let dragging_offset_x = null;
  let dragging_offset_y = null;
  let dragging_should_x = true;

  const dragging_started    = ref.make(null);
  const dragging_dimensions = ref.make(null);

  const tab_height = 20;

  // TODO move this into another module
  // TODO better implementation of this ?
  const hypot = (x, y) =>
    Math["sqrt"](x * x + y * y);


  const animation_tab = dom.make_animation({
    easing: ref.always("ease-in-out"),
    // TODO a little hacky
    duration: ref.map(opt("theme.animation"), (x) => (x ? "500ms" : "0ms")),
    from: {
      /*"transform": {
        "rotationX": "-90deg", // 120deg
        "rotationY": "5deg", // 20deg
        //"rotationZ": "-1deg", // -1deg
      },*/

      "border-top-width": ref.always("0px"),
      "border-bottom-width": ref.always("0px"),
      "padding-top": ref.always("0px"),
      "padding-bottom": ref.always("0px"),
      "height": ref.always("0px"),
      "opacity": ref.always("0"),

      // This needs to match the "margin-left" in "group.js"
      "margin-left": ref.always("12px"),
    }
  });

  const animation_tab_favicon = dom.make_animation({
    easing: ref.always("ease-in-out"),
    // TODO a little hacky
    duration: ref.map(opt("theme.animation"), (x) => (x ? "500ms" : "0ms")),
    from: {
      "height": ref.always("0px")
    }
  });

  const animation_tab_text = dom.make_animation({
    easing: ref.always("ease-in-out"),
    // TODO a little hacky
    duration: ref.map(opt("theme.animation"), (x) => (x ? "500ms" : "0ms")),
    from: {
      "transform": ref.always("rotateX(-90deg)"),
    }
  });

  const animation_tab_close = dom.make_animation({
    easing: ref.always("ease-in-out"),
    // TODO a little hacky
    duration: ref.map(opt("theme.animation"), (x) => (x ? "500ms" : "0ms")),
    from: {
      "height": ref.always("0px"),
      "border-top-width": ref.always("0px"),
      "border-bottom-width": ref.always("0px"),
    }
  });


  // TODO the mouse cursor should be "grabbing" while dragging
  //      https://developer.mozilla.org/en-US/docs/Web/CSS/cursor
  const style_dragging = dom.make_style({
    "pointer-events": ref.always("none"),
    "opacity": ref.always("0.98"),
    "overflow": ref.always("visible"),

    // This causes it to be displayed on its own layer, so that we can
    // move it around without causing a relayout or repaint
    "transform": ref.always("translate3d(0px, 0px, 0px)"),
  });


  const repeating = dom.repeating_gradient("-45deg",
                                           ["0px",  "transparent"],
                                           ["4px",  "transparent"],
                                           ["6px",  dom.hsl(0, 0, 100, 0.05)],
                                           ["10px", dom.hsl(0, 0, 100, 0.05)]);

  const style_menu_item = dom.make_style({
    "cursor": ref.always("pointer"),
    "border-width": ref.always("1px"),

    "transition": ref.latest([
      opt("theme.animation"),
      logic.dragging_animate
    ], (animation, dragging_animate) =>
      (animation
        ? (dragging_animate
            // TODO minor code duplication
            ? "background-color 100ms ease-in-out, transform 100ms ease-out"
            : "background-color 100ms ease-in-out")
        : null)),
  });

  const style_menu_item_shadow = dom.make_style({
    "box-shadow": ref.always("1px 1px  1px " + dom.hsl(0, 0,   0, 0.25) + "," +
                       "inset 0px 0px  3px " + dom.hsl(0, 0, 100, 1   ) + "," +
                       "inset 0px 0px 10px " + dom.hsl(0, 0, 100, 0.25)),
  });

  const style_menu_item_hover = dom.make_style({
    // TODO a bit hacky
    "transition-duration": ref.always("0ms"),

    "background-image": ref.always(dom.gradient("to bottom",
                                                ["0%",   dom.hsl(0, 0, 100, 0.2)],
                                                ["49%",  "transparent"          ],
                                                ["50%",  dom.hsl(0, 0,   0, 0.1)],
                                                ["80%",  dom.hsl(0, 0, 100, 0.1)],
                                                ["100%", dom.hsl(0, 0, 100, 0.2)]) + "," +
                                   repeating),
    "color": ref.always(dom.hsl(211, 100, 99, 0.95)),
    "background-color": ref.always(dom.hsl(211, 100, 65)),

    "border-color": ref.always(dom.hsl(211, 38, 62) + " " +
                               dom.hsl(211, 38, 57) + " " +
                               dom.hsl(211, 38, 52) + " " +
                               dom.hsl(211, 38, 57)),

    "text-shadow": ref.always("1px 0px 1px " + dom.hsl(0, 0, 0, 0.2) + "," +
                              "0px 0px 1px " + dom.hsl(0, 0, 0, 0.1) + "," +
                              "0px 1px 1px " + dom.hsl(0, 0, 0, 0.2)) // TODO why is it duplicated like this ?
  });

  const style_menu_item_hold = dom.make_style({
    "background-position": ref.always("0px 1px"),
    "background-image": ref.always(dom.gradient("to bottom",
                                                ["0%",   dom.hsl(0, 0, 100, 0.2)  ],
                                                ["49%",  "transparent"            ],
                                                ["50%",  dom.hsl(0, 0,   0, 0.075)],
                                                ["80%",  dom.hsl(0, 0, 100, 0.1)  ],
                                                ["100%", dom.hsl(0, 0, 100, 0.2)  ]) + "," +
                                   repeating),
    "box-shadow": ref.always("1px 1px 1px "  + dom.hsl(0, 0,   0, 0.1) + "," +
                       "inset 0px 0px 3px "  + dom.hsl(0, 0, 100, 0.9) + "," +
                       "inset 0px 0px 10px " + dom.hsl(0, 0, 100, 0.225)),
  });


  const style_tab = dom.make_style({
    "width": ref.always("100%"),
    "height": ref.always(tab_height + "px"),
    "padding": ref.always("1px"),
    "border-radius": ref.always("5px"),
  });

  const style_tab_hover = dom.make_style({
    "font-weight": ref.always("bold"),
  });

  const style_tab_hold = dom.make_style({
    "padding-top": ref.always("2px"),
    "padding-bottom": ref.always("0px"),
  });

  const style_tab_unloaded = dom.make_style({
    "color": ref.always(dom.hsl(0, 0, 30)),
    "opacity": ref.always("0.75"),
  });

  const style_tab_unloaded_hover = dom.make_style({
    "background-color": ref.always(dom.hsl(0, 0, 0, 0.4)),

    "border-color": ref.always(dom.hsl(0, 0, 62) + " " +
                               dom.hsl(0, 0, 57) + " " +
                               dom.hsl(0, 0, 52) + " " +
                               dom.hsl(0, 0, 57)),

    "color": ref.always(dom.hsl(0, 0, 99, 0.95)), // TODO minor code duplication with `style_menu_item_hover`
    "opacity": ref.always("1")
  });

  const style_tab_focused = dom.make_style({
    "background-color": ref.always(dom.hsl(30, 100, 94)),

    "border-color": ref.always(dom.hsl(30, 70, 62) + " " +
                               dom.hsl(30, 70, 57) + " " +
                               dom.hsl(30, 70, 52) + " " +
                               dom.hsl(30, 70, 57)),

    // TODO a bit hacky
    "transition-duration": ref.map(logic.dragging_animate, (dragging_animate) =>
                             (dragging_animate
                               ? null
                               : "0ms")),
  });

  const style_tab_focused_hover = dom.make_style({
    "background-color": ref.always(dom.hsl(30, 85, 57)),
  });

  const style_tab_selected = dom.make_style({
    "background-color": ref.always(dom.hsl(100, 78, 80)),

    "border-color": ref.always(dom.hsl(100, 50, 55) + " " +
                               dom.hsl(100, 50, 50) + " " +
                               dom.hsl(100, 50, 45) + " " +
                               dom.hsl(100, 50, 50)),

    /*"box-shadow": ref.always("inset 0px 1px 0px 0px " + dom.hsl(100, 70, 75) + "," +
                             "inset 0px -1px 0px 0px " + dom.hsl(100, 70, 70) + "," +
                             "inset 0px 0px 0px 1px " + dom.hsl(100, 70, 65) + "," +
                             "")*/
    /*
    background-image: -webkit-gradient(linear, 0% 0%, 0% 100%, from(transparent), color-stop(0.1, rgba(0, 0, 0, 0.02)), color-stop(0.8, transparent), color-stop(0.9, rgba(0, 0, 0, 0.03)), to(rgba(0, 0, 0, 0.04)))

    background-color: rgba(114, 255, 0, 0.3)

    border-color: hsl(120, 100%, 20%)
    */
  });

  const style_tab_selected_hover = dom.make_style({
    "background-color": ref.always(dom.hsl(100, 80, 45)),
  });

  const style_icon = dom.make_style({
    "height": ref.always("16px"),
    "border-radius": ref.always("4px"),
    "box-shadow": ref.always("0px 0px 15px " + dom.hsl(0, 0, 100, 0.9)),
    "background-color": ref.always(dom.hsl(0, 0, 100, 0.35))
  });

  const style_favicon = dom.make_style({
    "width": ref.always("16px"),
    "margin-left": ref.always("2px"),
    "margin-right": ref.always("1px")
  });

  const style_favicon_unloaded = dom.make_style({
    "filter": ref.always("grayscale(100%)")
  });

  const style_text = dom.make_style({
    "padding-left": ref.always("3px"),
    "padding-right": ref.always("1px")
  });

  const style_close = dom.make_style({
    "width": ref.always("18px"),
    "border-width": ref.always("1px"),
    "padding-left": ref.always("1px"),
    "padding-right": ref.always("1px")
  });

  const style_close_hover = dom.make_style({
    "background-color": ref.always(dom.hsl(0, 0, 100, 0.75)),
    "border-color": ref.always(dom.hsl(0, 0, 90, 0.75) + " " +
                               dom.hsl(0, 0, 85, 0.75) + " " +
                               dom.hsl(0, 0, 85, 0.75) + " " +
                               dom.hsl(0, 0, 90, 0.75))
  });

  const style_close_hold = dom.make_style({
    "padding-top": ref.always("1px"),
    "background-color": ref.always(dom.hsl(0, 0,  98, 0.75)),
    "border-color": ref.always(dom.hsl(0, 0,  70, 0.75) + " " +
                               dom.hsl(0, 0, 100, 0.75) + " " +
                               dom.hsl(0, 0, 100, 0.80) + " " +
                               dom.hsl(0, 0,  80, 0.75))
  });


  const animation_dragging = dom.make_animation({
    easing: ref.always("ease-out"),
    // TODO a little hacky
    duration: ref.map(opt("theme.animation"), (x) => (x ? "300ms" : "0ms")),
    from: {
      "margin-top": ref.always("0px")
    },
    to: {
      "margin-top": ref.always("-18px")
    }
  });

  const animation_dragging_hidden = dom.make_animation({
    easing: ref.always("ease-out"),
    // TODO a little hacky
    duration: ref.map(opt("theme.animation"), (x) => (x ? "300ms" : "0ms")),
    from: {
      "margin-top": ref.always("0px"),
      "opacity": ref.always("1")
    },
    to: {
      "margin-top": ref.always("-" + tab_height + "px"),
      "opacity": ref.always("0")
    }
  });

  // TODO code duplication
  const style_tab_dragging = dom.make_style({
    "margin-top": ref.always("-18px")
  });

  // TODO code duplication
  const style_tab_dragging_hidden = dom.make_style({
    "margin-top": ref.always("-" + tab_height + "px"),
    "opacity": ref.always("0")
  });


  const favicon = (tab) =>
    dom.image((e) => [
      // TODO use setTimeout to fix a bug with Chrome ?
      dom.set_url(e, record.get(tab, "favicon")),

      dom.add_style(e, style_icon),
      dom.add_style(e, style_favicon),
      dom.toggle_style(e, style_favicon_unloaded, record.get(tab, "unloaded")),

      dom.animate(e, animation_tab_favicon, {
        insert: "play-to",
        remove: "play-from",
      }),
    ]);

  const text = (tab) =>
    dom.text((e) => [
      dom.add_style(e, dom.stretch),
      dom.add_style(e, style_text),

      dom.animate(e, animation_tab_text, {
        insert: "play-to",
        remove: "play-from",
      }),

      // TODO what about dragging ?
      dom.set_tooltip(e, record.get(tab, "title")),

      dom.set_value(e, ref.latest([
        record.get(tab, "title"),
        record.get(tab, "unloaded")
      ], (title, unloaded) => {
        if (unloaded) {
          if (title === null) {
            return "➔";
          } else {
            return "➔ " + title;
          }

        } else {
          return title;
        }
      }))
    ]);

  const close = (tab, show) =>
    dom.image((e) => [
      dom.set_url(e, ref.always("data/images/button-close.png")),

      dom.add_style(e, style_icon),
      dom.add_style(e, style_close),

      dom.toggle_visible(e, show),

      dom.toggle_style(e, style_close_hover,
        dom.hovering(e)),

      dom.toggle_style(e, style_close_hold, ref.and([
        dom.hovering(e),
        dom.holding(e)
      ])),

      dom.animate(e, animation_tab_close, {
        insert: "play-to",
        remove: "play-from",
      }),

      dom.on_left_click(e, ({ shift, ctrl, alt }) => {
        if (!shift && !ctrl && !alt) {
          logic.close_tabs([tab]);
        }
      }),
    ]);

  // TODO code duplication with `tab`
  const ui_dragging = (tab, index) =>
    dom.parent((e) => {
      const is_hovering = ref.always(index === 0);

      // "selected" has precedence over "focused"
      // TODO code duplication
      const is_focused = ref.and([
        record.get(tab, "focused"),
        // TODO is this correct ?
        ref.map(opt("group.sort.type"), (x) => x === "window"),
        ref.not(record.get(tab, "selected"))
      ]);


      const ui_favicon = favicon(tab);

      const ui_text = text(tab);

      const ui_close = close(tab, ref.latest([
        opt("tabs.close.display"),
        is_hovering
      ], (display, hover) =>
        (display === "every") ||
        (display === "hover" && hover)));


      // TODO code duplication with `tab`
      return [
        dom.add_style(e, dom.row),
        dom.add_style(e, style_tab),
        dom.add_style(e, style_menu_item),
        dom.add_style(e, style_menu_item_shadow),


        dom.toggle_style(e, style_tab_hover, is_hovering),
        dom.toggle_style(e, style_menu_item_hover, is_hovering),


        dom.toggle_style(e, style_tab_selected, record.get(tab, "selected")),

        // TODO test this
        dom.toggle_style(e, style_tab_selected_hover, ref.and([
          record.get(tab, "selected"),
          is_hovering
        ])),


        dom.toggle_style(e, style_tab_focused, is_focused),

        dom.toggle_style(e, style_tab_focused_hover, ref.and([
          is_focused,
          is_hovering
        ])),


        // TODO test these
        dom.toggle_style(e, style_tab_unloaded, record.get(tab, "unloaded")),

        dom.toggle_style(e, style_tab_unloaded_hover, ref.and([
          record.get(tab, "unloaded"),
          is_hovering
        ])),


        dom.toggle_style(e, style_tab_dragging, ref.always(index >= 1 && index < 5)),

        dom.toggle_style(e, style_tab_dragging_hidden, ref.always(index >= 5)),


        // TODO a tiny bit hacky
        (index === 0
          ? dom.noop()
          : dom.animate(e, (index < 5
                             ? animation_dragging
                             : animation_dragging_hidden), {
              initial: "play-to"
            })),

        // TODO a bit hacky
        dom.style(e, {
          "z-index": ref.always(-index + "")
        }),

        // TODO code duplication
        dom.children(e, ref.map(opt("tabs.close.location"), (x) => {
          if (x === "left") {
            return [ui_close, ui_text, ui_favicon];

          } else if (x === "right") {
            return [ui_favicon, ui_text, ui_close];
          }
        })),
      ];
    });

  const dragging =
    dom.parent((e) => [
      dom.add_style(e, dom.floating),
      dom.add_style(e, style_dragging),

      dom.toggle_visible(e, dragging_started),

      dom.children(e, ref.map_null(dragging_started, ({ selected }) =>
        list.map(selected, (tab, index) =>
          ui_dragging(tab, index)))),

      dom.style(e, {
        "transform": ref.map_null(dragging_dimensions, ({ x, y }) =>
                       "translate3d(" + x + "px, " +
                                        y + "px, 0px)"),

        "width": ref.map_null(dragging_started, ({ width }) =>
                   width + "px")
      }),
    ]);

  // TODO hacky
  dom.push_root(dragging);

  const group_type = opt("group.sort.type");

  const drag_start_if = (start_x, start_y, { x, y, alt, ctrl, shift }) =>
    // TODO should also support dragging when the type is "tag"
    ref.get(group_type) === "window" &&
    !alt && !ctrl && !shift &&
    hypot(start_x - x, start_y - y) > 5;

  // TODO this should be a part of logic and stuff
  const drag_start = ({ group, tab, e, x, y }) => {
    dom.get_position(e, (tab_box) => {
      const tabs = record.get(group, "tabs");

      const selected = list.make();

      list.each(stream.current(tabs), (x) => {
        if (ref.get(record.get(x, "selected")) &&
            // TODO is this correct ?
            ref.get(record.get(x, "visible"))) {
          list.push(selected, x);
        }
      });

      if (list.size(selected) === 0) {
        list.push(selected, tab);
      }

      list.each(selected, (tab) => {
        ref.set(record.get(tab, "visible"), false);
      });

      // TODO hacky
      const height = (list.size(selected) === 1
                       ? tab_height
                       : (tab_height +
                          (Math["min"](list.size(selected), 4) * 3)));

      dragging_should_x = (ref.get(opt("groups.layout")) !== "vertical");
      dragging_offset_x = (x - tab_box.left);
      dragging_offset_y = (height / 2);

      ref.set(dragging_dimensions, {
        x: (x - dragging_offset_x),
        y: (y - dragging_offset_y)
      });

      ref.set(dragging_started, {
        selected: selected,
        width: Math["round"](tab_box.width)
      });

      logic.drag_start({ group, tab, height });
    });
  };

  const drag_move = ({ x, y }) => {
    // TODO is it faster to have two Refs, rather than using an object ?
    ref.set(dragging_dimensions, {
      x: (dragging_should_x
           ? (x - dragging_offset_x)
           // TODO a little bit hacky
           : ref.get(dragging_dimensions).x),
      y: (y - dragging_offset_y)
    });
  };

  const drag_end = () => {
    const { selected } = ref.get(dragging_started);

    list.each(selected, (tab) => {
      ref.set(record.get(tab, "visible"), true);

      /*if (i !== 0) {
        ref.set(record.get(tab, "animate"), {
          from: style_hidden,
          to: style_visible,
          duration: 500,
          easing: ease_out
        });
      }*/
    });

    logic.drag_end(selected);

    ref.set(dragging_started, null);
    ref.set(dragging_dimensions, null);

    dragging_should_x = true;
    dragging_offset_x = null;
    dragging_offset_y = null;
  };

  const tab = (group, tab) =>
    dom.parent((e) => {
      const is_hovering = ref.and([
        ref.not(dragging_started),
        dom.hovering(e)
      ]);

      const ui_favicon = favicon(tab);

      const ui_text = text(tab);

      const ui_close = close(tab, ref.latest([
        opt("tabs.close.display"),
        is_hovering
      ], (display, hover) =>
        (display === "every") ||
        (display === "hover" && hover)));

      const is_holding = ref.and([
        is_hovering,
        dom.holding(e),
        // TODO a little bit hacky
        ref.not(dom.hovering(ui_close))
      ]);

      // "selected" has precedence over "focused"
      // TODO code duplication
      const is_focused = ref.and([
        record.get(tab, "focused"),
        // TODO is this correct ?
        ref.map(opt("group.sort.type"), (x) => x === "window"),
        ref.not(record.get(tab, "selected"))
      ]);

      return [
        dom.children(e, ref.map(opt("tabs.close.location"), (x) => {
          if (x === "left") {
            return [ui_close, ui_text, ui_favicon];

          } else if (x === "right") {
            return [ui_favicon, ui_text, ui_close];
          }
        })),


        dom.add_style(e, dom.row),
        dom.add_style(e, style_tab),
        dom.add_style(e, style_menu_item),


        dom.toggle_style(e, style_tab_hover, is_hovering),
        dom.toggle_style(e, style_menu_item_hover, is_hovering),

        // TODO test this
        // TODO a little bit hacky
        dom.toggle_style(e, style_menu_item_shadow, ref.or([
          is_hovering,
          record.get(tab, "selected")
        ])),


        dom.toggle_style(e, style_tab_hold, is_holding),
        dom.toggle_style(e, style_menu_item_hold, is_holding),


        dom.toggle_style(e, style_tab_selected, record.get(tab, "selected")),

        // TODO test this
        dom.toggle_style(e, style_tab_selected_hover, ref.and([
          record.get(tab, "selected"),
          is_hovering
        ])),


        dom.toggle_style(e, style_tab_focused, is_focused),

        dom.toggle_style(e, style_tab_focused_hover, ref.and([
          is_focused,
          is_hovering
        ])),


        dom.toggle_style(e, style_tab_unloaded, record.get(tab, "unloaded")),

        dom.toggle_style(e, style_tab_unloaded_hover, ref.and([
          record.get(tab, "unloaded"),
          is_hovering
        ])),


        dom.animate(e, animation_tab, {
          insert: "play-to",
          remove: "play-from",
        }),


        dom.toggle_visible(e, record.get(tab, "visible")),

        dom.scroll_to(e, {
          // TODO maybe add `tab.get("visible")` to the definition of `is_focused` ?
          initial: ref.first(is_focused),
          // TODO make this work with vertical mode
          //insert: tab.get("visible")
        }),

        ref.listen(ref.latest([
          dom.hovering(e),
          dragging_started,
          record.get(tab, "url")
        ], (hover, dragging, url) => {
          if (hover && !dragging && url) {
            return url;

          } else {
            return null;
          }
        }), (x) => {
          ref.set(url_bar, x);
        }),

        dom.on_left_click(e, ({ shift, ctrl, alt }) => {
          // TODO a little hacky
          if (!ref.get(dom.hovering(ui_close))) {
            if (!shift && !ctrl && !alt) {
              logic.click_tab(group, tab);

            } else if (shift && !ctrl && !alt) {
              logic.shift_select_tab(group, tab);

            } else if (!shift && ctrl && !alt) {
              logic.ctrl_select_tab(group, tab);
            }
          }
        }),

        dom.on_middle_click(e, ({ shift, ctrl, alt }) => {
          if (!shift && !ctrl && !alt) {
            logic.close_tabs([tab]);
          }
        }),

        dom.on_right_click(e, (e) => {
          console.log("right click", e);
        }),

        dom.style(e, {
          "position": ref.map_null(record.get(tab, "top"), (x) =>
                        "absolute"),

          "transform": ref.map_null(record.get(tab, "top"), (x) =>
                         "translate3d(0px, " + x + ", 0px)")
        }),

        dom.on_mouse_hover(e, (hover) => {
          if (hover) {
            logic.drag_onto_tab(group, tab);
          }
        }),

        dom.draggable(e, {
          start_if: drag_start_if,
          start: ({ x, y }) => {
            drag_start({ group, tab, e, x, y });
          },
          move: drag_move,
          end: drag_end
        })
      ];
    });

  return async.done({ tab });
});
