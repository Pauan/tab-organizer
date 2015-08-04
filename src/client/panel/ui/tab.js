import * as logic from "../logic";
import * as dom from "../../dom";
import { async } from "../../../util/async";
import { List } from "../../../util/mutable/list";
import { url_bar } from "./url-bar";
import { latest, Ref, and, or, not, always } from "../../../util/mutable/ref";
import { each, map, indexed, empty } from "../../../util/iterator";
import { init as init_options } from "../../sync/options";


export const init = async(function* () {
  const { get: opt } = yield init_options;


  const $selected = new Ref(empty);
  const $dragging = new Ref(null);

  // TODO move this into another module
  // TODO better implementation of this ?
  const hypot = (x, y) =>
    Math["sqrt"](x * x + y * y);


  const animation_tab = dom.animation({
    easing: "ease-in-out",
    duration: "500ms",
    from: {
      "transform": always("rotateX(-90deg)"),
      /*"transform": {
        "rotationX": "-90deg", // 120deg
        "rotationY": "5deg", // 20deg
        //"rotationZ": "-1deg", // -1deg
      },*/

      "border-top-width": always("0px"),
      "border-bottom-width": always("0px"),
      "padding-top": always("0px"),
      "padding-bottom": always("0px"),
      "height": always("0px"),
      "opacity": always("0"),

      "margin-left": always("20px")
    }
  });


  const style_dragging = dom.style({
    "pointer-events": always("none"),
    "opacity": always("0.98"),
    "overflow": always("visible"),
  });


  const repeating = dom.repeating_gradient("-45deg",
                                           ["0px",  "transparent"],
                                           ["4px",  "transparent"],
                                           ["6px",  dom.hsl(0, 0, 100, 0.05)],
                                           ["10px", dom.hsl(0, 0, 100, 0.05)]);

  const style_menu_item = dom.style({
    "cursor": always("pointer"),
    "border-width": always("1px"),
    "cursor": always("pointer"),

    "transition": opt("theme.animation").map((animation) =>
                    (animation ? "background-color 100ms ease-in-out" : null)),

    "text-shadow": always("0px 1px 1px " + dom.hsl(211, 61, 50, 0.1))
  });

  const style_menu_item_shadow = dom.style({
    "box-shadow": always("1px 1px  1px " + dom.hsl(0, 0,   0, 0.25) + "," +
                   "inset 0px 0px  3px " + dom.hsl(0, 0, 100, 1   ) + "," +
                   "inset 0px 0px 10px " + dom.hsl(0, 0, 100, 0.25)),
  });

  const style_menu_item_hover = dom.style({
    // TODO a bit hacky
    "transition-duration": always("0ms"),

    "background-image": always(dom.gradient("to bottom",
                                            ["0%",   dom.hsl(0, 0, 100, 0.2)],
                                            ["49%",  "transparent"          ],
                                            ["50%",  dom.hsl(0, 0,   0, 0.1)],
                                            ["80%",  dom.hsl(0, 0, 100, 0.1)],
                                            ["100%", dom.hsl(0, 0, 100, 0.2)]) + "," +
                               repeating),
    "color": always(dom.hsl(211, 100, 99, 0.95)),
    "background-color": always(dom.hsl(211, 100, 65)),
    "border-color": always(dom.hsl(211, 38, 57)),
    "text-shadow": always("1px 0px 1px " + dom.hsl(211, 61, 50) + "," +
                          "0px 1px 1px " + dom.hsl(211, 61, 50)) // TODO why is it duplicated like this ?
  });

  const style_menu_item_hold = dom.style({
    "background-position": always("0px 1px"),
    "background-image": always(dom.gradient("to bottom",
                                            ["0%",   dom.hsl(0, 0, 100, 0.2)  ],
                                            ["49%",  "transparent"            ],
                                            ["50%",  dom.hsl(0, 0,   0, 0.075)],
                                            ["80%",  dom.hsl(0, 0, 100, 0.1)  ],
                                            ["100%", dom.hsl(0, 0, 100, 0.2)  ]) + "," +
                               repeating),
    "box-shadow": always("1px 1px 1px "  + dom.hsl(0, 0,   0, 0.1) + "," +
                   "inset 0px 0px 3px "  + dom.hsl(0, 0, 100, 0.9) + "," +
                   "inset 0px 0px 10px " + dom.hsl(0, 0, 100, 0.225)),
  });


  const style_tab = dom.style({
    "width": always("100%"),
    "height": always("20px"),
    "padding": always("1px"),
    "border-radius": always("5px"),

    // Magical incantation to make it much smoother
    "transform": always("translate3d(0px, 0px, 0px)"),
  });

  const style_tab_hover = dom.style({
    "font-weight": always("bold"),
  });

  const style_tab_hold = dom.style({
    "padding-top": always("2px"),
    "padding-bottom": always("0px"),
  });

  const style_tab_unloaded = dom.style({
    "color": always(dom.hsl(0, 0, 30)),
    "opacity": always("0.75"),
  });

  const style_tab_unloaded_hover = dom.style({
    "background-color": always(dom.hsl(0, 0, 0, 0.4)),
    "text-shadow": always("1px 0px 1px " + dom.hsl(0, 0, 0, 0.4) + "," +
                          "0px 1px 1px " + dom.hsl(0, 0, 0, 0.4)), // TODO why is it duplicated like this ?
    "border-color": always(dom.hsl(0, 0, 0, 0.2)),

    "color": always(dom.hsl(0, 0, 99, 0.95)), // TODO minor code duplication with `style_menu_item_hover`
    "opacity": always("1")
  });

  const style_tab_focused = dom.style({
    "background-color": always(dom.hsl(30, 100, 94)),
    "border-color":     always(dom.hsl(30, 100, 40)),
    // TODO a bit hacky
    "transition-duration": always("0ms"),
  });

  const style_tab_focused_hover = dom.style({
    "background-color": always(dom.hsl(30, 85, 57)),
    // TODO code duplication with `style_menu_item_hover`
    "text-shadow": always("1px 0px 1px " + dom.hsl(30, 61, 50) + "," +
                          "0px 1px 1px " + dom.hsl(30, 61, 50)) // TODO why is it duplicated like this ?
  });

  const style_tab_selected = dom.style({
    "background-color": always("green"),
    "border-color": always("black"),
  });

  const style_icon = dom.style({
    "height": always("16px"),
    "border-radius": always("4px"),
    "box-shadow": always("0px 0px 15px " + dom.hsl(0, 0, 100, 0.9)),
    "background-color": always(dom.hsl(0, 0, 100, 0.35))
  });

  const style_favicon = dom.style({
    "width": always("16px"),
    "margin-left": always("2px"),
    "margin-right": always("1px")
  });

  const style_favicon_unloaded = dom.style({
    "filter": always("grayscale(100%)")
  });

  const style_text = dom.style({
    "padding-left": always("3px"),
    "padding-right": always("1px")
  });

  const style_close = dom.style({
    "width": always("18px"),
    "border-width": always("1px"),
    "padding-left": always("1px"),
    "padding-right": always("1px")
  });

  const style_close_hover = dom.style({
    "background-color": always(dom.hsl(0, 0, 100, 0.75)),
    "border-color": always(dom.hsl(0, 0, 90, 0.75))
  });

  const style_close_hold = dom.style({
    "padding-top": always("1px"),
    "background-color": always(dom.hsl(0, 0,  98, 0.75)),
    "border-color": always(dom.hsl(0, 0,  70, 0.75) + " " +
                           dom.hsl(0, 0, 100, 0.75) + " " +
                           dom.hsl(0, 0, 100, 0.80) + " " +
                           dom.hsl(0, 0,  80, 0.75))
  });


  const animation_dragging = dom.animation({
    easing: "ease-out",
    duration: "300ms",
    from: {
      "margin-top": always("0px")
    },
    to: {
      "margin-top": always("-18px")
    }
  });

  const animation_dragging_hidden = dom.animation({
    easing: "ease-out",
    duration: "300ms",
    from: {
      "margin-top": always("0px"),
      "opacity": always("1")
    },
    to: {
      "margin-top": always("-20px"),
      "opacity": always("0")
    }
  });

  const style_tab_dragging = dom.style({
    "margin-top": always("-18px")
  });

  const style_tab_dragging_hidden = dom.style({
    "margin-top": always("-20px"),
    "opacity": always("0")
  });


  const favicon = (tab) =>
    dom.image((e) => [
      // TODO use setTimeout to fix a bug with Chrome ?
      e.url(tab.get("favicon")),

      e.set_style(style_icon, always(true)),
      e.set_style(style_favicon, always(true)),
      e.set_style(style_favicon_unloaded, tab.get("unloaded")),
    ]);

  const text = (tab) =>
    dom.text((e) => [
      e.set_style(dom.stretch, always(true)),
      e.set_style(style_text, always(true)),

      // TODO what about dragging ?
      e.tooltip(tab.get("title")),

      e.value(latest([
        tab.get("title"),
        tab.get("unloaded")
      ], (title, unloaded) => {
        if (unloaded) {
          return "➔ " + title;
        } else {
          return title;
        }
      }))
    ]);

  const close = (tab, show) =>
    dom.image((e) => [
      e.url(always("data/images/button-close.png")),

      e.set_style(style_icon, always(true)),
      e.set_style(style_close, always(true)),

      e.visible(show),

      e.set_style(style_close_hover,
        e.hovering()),

      e.set_style(style_close_hold, and([
        e.hovering(),
        e.holding()
      ])),

      e.on_left_click(({ shift, ctrl, alt }) => {
        if (!shift && !ctrl && !alt) {
          logic.close_tabs([tab]);
        }
      }),
    ]);

  const ui_dragging = (tab, index) =>
    dom.parent((e) => {
      const is_hovering = always(index === 0);

      // "selected" has precedence over "focused"
      // TODO code duplication
      const is_focused = and([
        tab.get("focused"),
        // TODO is this correct ?
        opt("group.sort.type").map((x) => x === "window"),
        not(tab.get("selected"))
      ]);


      const ui_favicon = favicon(tab);

      const ui_text = text(tab);

      const ui_close = close(tab, opt("tabs.close.display").map((display) =>
                                    (display === "every")));


      // TODO code duplication with `tab`
      return [
        e.set_style(dom.row, always(true)),
        e.set_style(style_tab, always(true)),
        e.set_style(style_menu_item, always(true)),
        e.set_style(style_menu_item_shadow, always(true)),


        e.set_style(style_tab_hover, is_hovering),
        e.set_style(style_menu_item_hover, is_hovering),


        e.set_style(style_tab_selected, tab.get("selected")),


        e.set_style(style_tab_focused, is_focused),

        e.set_style(style_tab_focused_hover, and([
          is_focused,
          is_hovering
        ])),


        // TODO test these
        e.set_style(style_tab_unloaded, tab.get("unloaded")),

        e.set_style(style_tab_unloaded_hover, and([
          tab.get("unloaded"),
          is_hovering
        ])),


        // TODO a tiny bit hacky
        (index === 0
          ? e.noop()
          : e.set_style((index < 5
                          ? style_tab_dragging
                          : style_tab_dragging_hidden), always(true))),


        // TODO a tiny bit hacky
        (index === 0
          ? e.noop()
          : e.animate((index < 5
                        ? animation_dragging
                        : animation_dragging_hidden), {
              initial: "play-to"
            })),

        // TODO a bit hacky
        e.style({
          "z-index": always(-index + "")
        }),

        // TODO code duplication
        e.set_children(opt("tabs.close.location").map((x) => {
          if (x === "left") {
            return [ui_close, ui_text, ui_favicon];

          } else if (x === "right") {
            return [ui_favicon, ui_text, ui_close];
          }
        })),
      ];
    });

  const drag_style = (f) =>
    $dragging.map((info) =>
      (info === null
        ? null
        : f(info) + "px"));

  const dragging =
    dom.parent((e) => [
      e.set_style(dom.col, always(true)),
      e.set_style(dom.floating, always(true)),
      e.set_style(style_dragging, always(true)),

      e.visible($dragging),

      e.set_children($selected.map((selected) =>
        map(indexed(selected), ([index, tab]) =>
          ui_dragging(tab, index)))),

      e.style({
        "left":  drag_style((info) => info.x),
        "top":   drag_style((info) => info.y),
        "width": drag_style((info) => info.width)
      }),
    ]);

  // TODO hacky
  dom.main(dragging);

  const group_type = opt("group.sort.type");

  const drag_start_if = (start_x, start_y, { x, y, alt, ctrl, shift }) =>
    // TODO should also support dragging when the type is "tag"
    group_type.get() === "window" &&
    !alt && !ctrl && !shift &&
    hypot(start_x - x, start_y - y) > 5;

  const drag_start = ({ group, tab, e, x, y }) => {
    const tab_box = e.get_position();

    const tabs = group.get("tabs");

    const selected = new List();

    each(tabs, (x) => {
      if (x.get("selected").get()) {
        selected.push(x);
      }
    });

    if (selected.size === 0) {
      selected.push(tab);
    }

    each(selected, (tab) => {
      tab.get("visible").set(false);
    });

    // TODO hacky
    const height = (selected.size === 1
                     ? tab_box.height
                     : (tab_box.height +
                        (Math["min"](selected.size, 4) * 3)));

    const offset_x = (x - tab_box.left);
    const offset_y = (height / 2);

    $selected.set(selected);

    $dragging.set({
      offset_x: offset_x,
      offset_y: offset_y,

      x: (x - offset_x),
      y: (y - offset_y),
      width: tab_box.width
    });

    logic.drag_start({ group, tab, height });
  };

  const drag_move = ({ x, y }) => {
    $dragging.modify(({ offset_x, offset_y, x, width }) => {
      // TODO hacky
      return {
        offset_x,
        offset_y,
        x,
        //x: (x - offset_x),
        y: (y - offset_y),
        width
      };
    });
  };

  const drag_end = () => {
    const selected = $selected.get();

    each(selected, (tab) => {
      tab.get("visible").set(true);

      /*if (i !== 0) {
        tab.get("animate").set({
          from: style_hidden,
          to: style_visible,
          duration: 500,
          easing: ease_out
        });
      }*/
    });

    logic.drag_end(selected);

    $selected.set(empty);
    $dragging.set(null);
  };

  const tab = (group, tab) =>
    dom.parent((e) => {
      const is_hovering = and([
        not($dragging),
        e.hovering()
      ]);

      const ui_favicon = favicon(tab);

      const ui_text = text(tab);

      const ui_close = close(tab, latest([
        opt("tabs.close.display"),
        is_hovering
      ], (display, hover) => (display === "every") ||
                             (display === "hover" && hover)));

      const is_holding = and([
        is_hovering,
        e.holding(),
        // TODO a little bit hacky
        not(ui_close.hovering())
      ]);

      // "selected" has precedence over "focused"
      // TODO code duplication
      const is_focused = and([
        tab.get("focused"),
        // TODO is this correct ?
        opt("group.sort.type").map((x) => x === "window"),
        not(tab.get("selected"))
      ]);

      const is_visible = and([
        tab.get("matches"),
        tab.get("visible")
      ]);

      return [
        e.set_children(opt("tabs.close.location").map((x) => {
          if (x === "left") {
            return [ui_close, ui_text, ui_favicon];

          } else if (x === "right") {
            return [ui_favicon, ui_text, ui_close];
          }
        })),


        e.set_style(dom.row, always(true)),
        e.set_style(style_tab, always(true)),
        e.set_style(style_menu_item, always(true)),


        e.set_style(style_tab_hover, is_hovering),
        e.set_style(style_menu_item_hover, is_hovering),
        e.set_style(style_menu_item_shadow, is_hovering),


        e.set_style(style_tab_hold, is_holding),
        e.set_style(style_menu_item_hold, is_holding),


        e.set_style(style_tab_selected, tab.get("selected")),


        e.set_style(style_tab_focused, is_focused),

        e.set_style(style_tab_focused_hover, and([
          is_focused,
          is_hovering
        ])),


        e.set_style(style_tab_unloaded, tab.get("unloaded")),

        e.set_style(style_tab_unloaded_hover, and([
          tab.get("unloaded"),
          is_hovering
        ])),


        e.animate(animation_tab, {
          insert: "play-to",
          remove: "play-from",
        }),


        e.visible(is_visible),

        e.scroll_to({
          // TODO maybe add `is_visible` to the definition of `is_focused` ?
          initial: and([
            is_focused,
            is_visible
          ]),
          insert: is_visible
        }),

        latest([
          e.hovering(),
          $dragging,
          tab.get("url")
        ], (hover, dragging, url) => {
          if (hover && !dragging && url) {
            return {
              x: hover.x,
              y: hover.y,
              url: url
            };

          } else {
            return null;
          }
        }).each((x) => {
          url_bar.set(x);
        }),

        e.on_left_click(({ shift, ctrl, alt }) => {
          // TODO a little hacky
          if (!ui_close.hovering().get()) {
            if (!shift && !ctrl && !alt) {
              logic.deselect_tab(group, tab);
              logic.focus_tab(tab);

            } else if (shift && !ctrl && !alt) {
              logic.shift_select_tab(group, tab);

            } else if (!shift && ctrl && !alt) {
              logic.ctrl_select_tab(group, tab);
            }
          }
        }),

        e.on_middle_click(({ shift, ctrl, alt }) => {
          if (!shift && !ctrl && !alt) {
            logic.close_tabs([tab]);
          }
        }),

        e.on_right_click((e) => {
          console.log("right click", e);
        }),

        e.style({
          "transition": tab.get("animate").map((x) =>
                          (x ? "transform 100ms ease-out" : null)),

          "position": tab.get("top").map((x) =>
                        (x !== null ? "absolute" : null)),

          "transform": tab.get("top").map((x) =>
                         (x !== null
                           ? "translate3d(0px, " + x + ", 0px)"
                           : null))
        }),

        e.on_mouse_hover((hover) => {
          if (hover) {
            logic.drag_onto_tab(group, tab);
          }
        }),

        e.draggable({
          start_if: drag_start_if,
          start: ({ x, y }) => {
            drag_start({ group, tab, e, x, y });
          },
          move: drag_move,
          end: drag_end
        })
      ];
    });

  return { tab };
});
