import * as logic from "../logic";
import * as dom from "../../dom";
import { List } from "../../../util/mutable/list";
import { url_bar } from "./url-bar";
import { latest, Ref, and, or, not, always } from "../../../util/mutable/ref";
import { each, map, indexed, empty } from "../../../util/iterator";


const $selected = new Ref(empty);
const $dragging = new Ref(null);

// TODO move this into another module
// TODO better implementation of this ?
const hypot = (x, y) =>
  Math["sqrt"](x * x + y * y);


const style_dragging = dom.style({
  "pointer-events": always("none"),
  "opacity": always("0.98")
});

const style_tab = dom.style({
  // TODO is this correct ?
  "overflow": always("hidden"),

  "width": always("100%"),

  "border-left-width": always("1px"),
  "border-right-width": always("1px"),
  "padding-left": always("1px"),
  "padding-right": always("1px"),
  "border-radius": always("5px"),

  "transition": always("background-color 100ms ease-in-out"),

  // Magical incantation to make it much smoother
  "transform": always("translate3d(0px, 0px, 0px)"),

  // TODO test this
  "transform-origin": always("11px 50%"),

  "text-shadow": always("0px 1px 1px " + dom.hsl(211, 61, 50, 0.1))
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

// TODO code duplication
const animation_dragging_hidden = dom.animation({
  easing: "ease-out",
  duration: "300ms",
  from: {
    "border-top-width": always("1px"),
    "border-bottom-width": always("1px"),
    "padding-top": always("1px"),
    "padding-bottom": always("1px"),
    "height": always("20px"),
  },
  to: {
    "border-top-width": always("0px"),
    "border-bottom-width": always("0px"),
    "padding-top": always("0px"),
    "padding-bottom": always("0px"),
    "height": always("0px"),
  }
});

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
    "opacity": always("0")
  },
  to: {
    "transform": always("rotateX(0deg)"),
    "border-top-width": always("1px"),
    "border-bottom-width": always("1px"),
    "padding-top": always("1px"),
    "padding-bottom": always("1px"),
    "height": always("20px"),
    "opacity": always("1")
  }
});

const style_unloaded = dom.style({
  "color": always(dom.hsl(0, 0, 30)),
  "opacity": always("0.75"),
});

const style_focused = dom.style({
  "background-color": always(dom.hsl(30, 100, 94)),
  "border-color":     always(dom.hsl(30, 100, 40)),
  // TODO a bit hacky
  "transition-duration": always("0ms"),
});

const repeating = dom.repeating_gradient("-45deg",
                                         ["0px",  "transparent"],
                                         ["4px",  "transparent"],
                                         ["6px",  dom.hsl(0, 0, 100, 0.05)],
                                         ["10px", dom.hsl(0, 0, 100, 0.05)]);

const style_hover = dom.style({
  "cursor": always("pointer"),
  "font-weight": always("bold"),

  "z-index": always("1"),

  // TODO a bit hacky
  "transition-duration": always("0ms"),

  "background-image": always(dom.gradient("to bottom",
                                          ["0%",   dom.hsl(0, 0, 100, 0.2)],
                                          ["49%",  "transparent"          ],
                                          ["50%",  dom.hsl(0, 0,   0, 0.1)],
                                          ["80%",  dom.hsl(0, 0, 100, 0.1)],
                                          ["100%", dom.hsl(0, 0, 100, 0.2)]) + "," +
                             repeating),
  "box-shadow": always("1px 1px  1px " + dom.hsl(0, 0,   0, 0.25) + "," +
                 "inset 0px 0px  3px " + dom.hsl(0, 0, 100, 1   ) + "," +
                 "inset 0px 0px 10px " + dom.hsl(0, 0, 100, 0.25)),
  "color": always(dom.hsl(211, 100, 99, 0.95)),
  "background-color": always(dom.hsl(211, 100, 65)),
  "border-color": always(dom.hsl(211, 38, 57)),
  "text-shadow": always("1px 0px 1px " + dom.hsl(211, 61, 50) + "," +
                        "0px 1px 1px " + dom.hsl(211, 61, 50))
});

const style_hold = dom.style({
  "padding-top": always("2px"),
  "padding-bottom": always("0px"),

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

const style_selected = dom.style({
  "background-color": always("green"),
  "border-color": always("black"),

  // TODO code duplication
  "box-shadow": always("1px 1px  1px " + dom.hsl(0, 0,   0, 0.25) + "," +
                 "inset 0px 0px  3px " + dom.hsl(0, 0, 100, 1   ) + "," +
                 "inset 0px 0px 10px " + dom.hsl(0, 0, 100, 0.25)),
});

const style_icon = dom.style({
  "height": always("16px"),
  "border-radius": always("4px"),
  "box-shadow": always("0px 0px 15px " + dom.hsl(0, 0, 100, 0.9)),
  "background-color": always(dom.hsl(0, 0, 100, 0.35))
});

const style_favicon = dom.style({
  "width": always("16px")
});

const style_text = dom.style({
  "padding-left": always("2px"),
  "padding-right": always("2px")
});

const style_close = dom.style({
  "width": always("18px"),
  "border-width": always("1px"),
  "padding-left": always("1px"),
  "padding-right": always("1px")
});


const favicon = (tab) =>
  dom.image((e) => [
    // TODO use setTimeout to fix a bug with Chrome ?
    e.url(tab.get("favicon")),

    e.set_style(style_icon, always(true)),
    e.set_style(style_favicon, always(true))
  ]);

const text = (tab) =>
  dom.text((e) => [
    e.set_style(dom.stretch, always(true)),
    e.set_style(style_text, always(true)),

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

    e.visible(show)

    //e.set_style(ui_tab_close_style_hover,
    //  e.hovering()),

    //e.set_style(ui_tab_close_style_hold,
    //  and([
    //    e.hovering(),
    //    e.holding()
    //  ])),
  ]);

const ui_dragging = (tab, index) =>
  dom.row((e) => [
    e.set_style(style_tab, always(true)),
    e.set_style(style_selected, tab.get("selected")),
    e.set_style(style_hover, always(index === 0)),

    e.animate(animation_tab, {
      initial: "set-to"
    }),

    // TODO a tiny bit hacky
    (index === 0
      ? e.noop()
      : e.animate((index < 5
                    ? animation_dragging
                    : animation_dragging_hidden), {
          initial: "play-to"
        })),

    e.style({
      "z-index": always(-index + "")
    }),

    e.children([
      favicon(tab),
      text(tab)
    ])
  ]);

const drag_style = (f) =>
  $dragging.map((info) =>
    (info === null
      ? null
      : f(info) + "px"));

const dragging =
  dom.floating((e) => [
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

const drag_start_if = (start_x, start_y, { x, y, alt, ctrl, shift }) =>
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

export const tab = (group, tab) =>
  dom.row((e) => [
    e.set_style(style_tab, always(true)),

    e.animate(animation_tab, {
      initial: "set-to",
      insert: "play-to",
      remove: "play-from",
    }),

    e.set_style(style_hover, and([
      not($dragging),
      e.hovering()
    ])),

    e.set_style(style_hold, and([
      not($dragging),
      e.hovering(),
      e.holding()
    ])),

    e.set_style(style_selected, tab.get("selected")),

    e.set_style(style_focused, tab.get("focused")),

    e.set_style(style_unloaded, tab.get("unloaded")),

    e.visible(and([
      tab.get("matches"),
      tab.get("visible")
    ])),

    //e.scroll_to(tab.get("focused")),

    e.children([
      favicon(tab),

      text(tab),

      close(tab,
        and([
          not($dragging),
          e.hovering()
        ]))
    ]),

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
      if (!shift && !ctrl && !alt) {
        logic.deselect_tab(group, tab);
        logic.focus_tab(tab);

      } else if (shift && !ctrl && !alt) {
        logic.shift_select_tab(group, tab);

      } else if (!shift && ctrl && !alt) {
        logic.ctrl_select_tab(group, tab);
      }
    }),

    e.on_middle_click((e) => {
      console.log("middle click", e);
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
  ]);
