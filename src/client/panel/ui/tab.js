import * as dom from "../../dom";
import { List } from "../../../util/mutable/list";
import { url_bar } from "./url-bar";
import { latest, Ref, and, or, not, always } from "../../../util/mutable/ref";
import { each, indexed } from "../../../util/iterator";
import { ease_in, ease_out } from "../../../util/animate";
import { move_tabs } from "../logic";


const $selected = new List();

const $dragging = new Ref(null);

export const drag_info = new Ref(null);

// TODO move this into another module
// TODO better implementation of this ?
const hypot = (x, y) =>
  Math["sqrt"](x * x + y * y);


const style_dragging = dom.style({
  "pointer-events": always("none"),
  "opacity": always("0.98")
});

const style_tab = dom.style({
  "overflow": always("hidden"),

  "background-color": always("inherit"),

  "border-left-width": always("1px"),
  "border-right-width": always("1px"),
  "padding-left": always("1px"),
  "padding-right": always("1px"),
  "border-radius": always("5px"),

  "transition-property": always("background-color"),
  "transition-timing-function": always("ease-in-out"),
  "transition-duration": always("100ms"),

  //"transform-origin": "11px 50%",
  //"transform": "translate3d(0, 0, 0)", /* TODO this is a hack to make animation smoother, should replace with something else */

  "text-shadow": always("0px 1px 1px " + dom.hsl(211, 61, 50, 0.1))
});

const style_unloaded = dom.style({
  "color": always(dom.hsl(0, 0, 30)),
  "opacity": always("0.75"),
});

const style_focused = dom.style({
  "background-color": always(dom.hsl(30, 100, 94)),
  "border-color":     always(dom.hsl(30, 100, 40)),
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

const style_hidden = dom.style({
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
});

const style_visible = dom.style({
  "border-top-width": always("1px"),
  "border-bottom-width": always("1px"),
  "padding-top": always("1px"),
  "padding-bottom": always("1px"),
  "height": always("20px"),
  "opacity": always("1")
});

const style_drag_stacked = dom.style({
  "margin-top": always("-18px")
});

const style_drag_normal = dom.style({
  "margin-top": always("0px")
});


// TODO a bit hacky
const margin_top_visible = dom.style({
  "margin-top": drag_info.map((info) =>
                  (info
                    ? info.height + "px"
                    : "0px"))
});

// TODO a bit hacky
const margin_top_hidden = dom.style({
  "margin-top": always("0px")
});

// TODO a bit hacky
const margin_bottom_visible = dom.style({
  "margin-bottom": drag_info.map((info) =>
                     (info
                       ? info.height + "px"
                       : "0px"))
});

// TODO a bit hacky
const margin_bottom_hidden = dom.style({
  "margin-bottom": always("0px")
});


const favicon = (tab) =>
  dom.image((e) => [
    // TODO use setTimeout to fix a bug with Chrome ?
    e.url(tab.get("favicon")),

    e.set_style(style_icon, always(true)),
    e.set_style(style_favicon, always(true))
  ]);

const text = (tab) =>
  dom.stretch((e) => [
    e.set_style(style_text, always(true)),

    e.children([
      dom.text(latest([
        tab.get("title"),
        tab.get("unloaded")
      ], (title, unloaded) => {
        if (unloaded) {
          return "➔ " + title;
        } else {
          return title;
        }
      }))
    ])
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

const ui_dragging_style = (e, index) => {
  /*if (index === 0) {
    // Do nothing

  } else if (index < 5) {
    return e.animate({
      from: style_drag_normal,
      to: style_drag_stacked,
      duration: 500,
      seek: always(1)
    });

  } else {
    return e.animate({
      from: style_visible,
      to: style_hidden,
      duration: 500,
      seek: always(1)
    });
  }*/
};

// TODO the index probably isn't reliable (should use a Ref of List rather than a List)
const ui_dragging = (tab, index) =>
  dom.row((e) => [
    e.set_style(style_tab, always(true)),
    e.set_style(style_visible, always(true)),
    e.set_style(style_selected, always(true)),
    e.set_style(style_hover, always(index === 0)),

    e.style({
      "z-index": always(-index + "")
    }),

    ui_dragging_style(e, index),

    e.children([
      favicon(tab),
      text(tab)
    ])
  ]);

const drag_style = (f) =>
  $dragging.map((info) => {
    if (info === null) {
      return null;
    } else {
      return f(info) + "px";
    }
  });

const dragging =
  dom.floating((e) => [
    e.set_style(style_dragging, always(true)),

    e.visible($dragging),

    // TODO hacky
    e.children($selected.map((tab, index) =>
      ui_dragging(tab, index))),

    e.style({
      "left":  drag_style((info) => info.x),
      "top":   drag_style((info) => info.y),
      "width": drag_style((info) => info.width)
    }),
  ]);

export const tab = (group, tab) =>
  dom.row((e) => [
    e.set_style(style_tab, always(true)),

    e.set_style(style_visible, always(true)),

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

    e.visible(tab.get("visible")),

    //e.animate(tab.get("animate")),

    /*e.animate_when(not(tab.get("visible")), {
      from: style_visible,
      to: style_hidden,
      duration: 500
    }),*/

    // TODO hacky
    /*e.animate_when(tab.get("visible").map((x) => x &&
                                                 $selected.has(0) &&
                                                 $selected.get(0) !== tab), {
      from: style_hidden,
      to: style_visible,
      duration: 500,
      easing: (x) => x
    }),*/

    /*e.style({
      "visibility": tab.get("visible").map((x) => {
        if (x) {
          return null;
        } else {
          return "hidden";
        }
      })
    }),*/

    e.scroll_to(tab.get("focused")),

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

    /*e.animate_on({
      insert: {
        from: style_hidden,
        to: style_visible,
        duration: 1000
      },

      remove: {
        from: style_visible,
        to: style_hidden,
        duration: 1000
      }
    }),*/

    e.on_left_click(({ shift, ctrl, alt }) => {
      const selected_tab = group.get("first-selected-tab");

      if (!shift && !ctrl && !alt) {
        if (!tab.get("selected").get()) {
          group.update("first-selected-tab", null);

          each(group.get("tabs"), (tab) => {
            tab.get("selected").set(false);
          });
        }


      } else if (shift && !ctrl && !alt) {
        if (selected_tab === null) {
          group.update("first-selected-tab", tab);

          tab.get("selected").set(true);

        } else if (tab !== selected_tab) {
          let seen = 0;

          each(group.get("tabs"), (x) => {
            if (x === tab || x === selected_tab) {
              x.get("selected").set(true);
              ++seen;

            } else if (seen === 1) {
              x.get("selected").set(true);

            } else {
              x.get("selected").set(false);
            }
          });
        }


      } else if (!shift && ctrl && !alt) {
        tab.get("selected").modify((selected) => {
          if (selected) {
            group.update("first-selected-tab", null);
            return false;

          } else {
            group.update("first-selected-tab", tab);
            return true;
          }
        });
      }
    }),

    e.on_middle_click((e) => {
      console.log("middle click", e);
    }),

    e.on_right_click((e) => {
      console.log("right click", e);
    }),

    e.style({
      "position": tab.get("top").map((x) =>
                    (x !== null ? "absolute" : null)),
      "transform": tab.get("top").map((x) =>
                     (x !== null
                       ? "translate3d(0, " + (x * 100) + "%, 0)"
                       : null))
      "transition": drag_info.map((dragging) =>
                      (dragging
                        ? "transform 100ms linear"
                        : null))
    }),

    /*e.animate({
      from: margin_top_hidden,
      to: margin_top_visible,
      duration: 100,
      //easing: ease_in_out,
      seek: tab.get("placing").map((x) => (x === "up" ? 1 : 0))
    }),

    e.animate({
      from: margin_bottom_hidden,
      to: margin_bottom_visible,
      duration: 100,
      //easing: ease_in_out,
      seek: tab.get("placing").map((x) => (x === "down" ? 1 : 0))
    }),*/

    e.on_mouse_hover((hover) => {
      const info = drag_info.get();

      if (hover && info) {
        //info.tab.get("placing").set(null);

        drag_info.set({
          group: group,
          tab: tab,
          height: info.height,

          // TODO a little hacky
          direction: (() => {
            if (info.tab === tab) {
              return (info.direction === "up"
                       ? "down"
                       : "up");

            } else if (info.group === group) {
              // TODO is there a better way than using indexes ?
              const old_index = info.tab.get("index");
              const new_index = tab.get("index");

              if (old_index < new_index) {
                return "down";

              } else {
                return "up";
              }

            } else {
              return "up";
            }
          })()
        });

        const direction = drag_info.get().direction;

        tab.get("top").modify((i) => (direction === "up" ? i + 1 : i - 1));

        /*let i = 0;

        // TODO find a more efficient way to do this
        each(group.get("tabs"), (x) => {
          if (x === tab && direction === "up") {
            ++i;
          }

          if (!x.get("selected").get()) {
            x.get("top").set(i);
            ++i;
          }

          if (x === tab && direction === "down") {
            ++i;
          }
        });*/

        //tab.get("placing").set(drag_info.get().direction);
      }
    }),

    /*e.style({
      "transition": latest([
        drag_info,
      ], (dragging) => {
        if (dragging) {
          return "margin 100ms linear";
        } else {
          return null;
        }
      }),

      "margin": drag_info.map((info) => {
        // TODO inefficient
        if (info && info.tab === tab) {
          return (info.direction === "up"
                   ? info.height
                   : "0") +
                 "px 0px " +
                 (info.direction === "down"
                   ? info.height
                   : "0") +
                 "px 0px";
        } else {
          return null;
        }
      })
    }),*/

    e.draggable({
      start_if: (start_x, start_y, { x, y, alt, ctrl, shift }) =>
        //false &&
        !alt && !ctrl && !shift &&
        hypot(start_x - x, start_y - y) > 5,

      start: ({ x, y }) => {
        const tab_box = e.get_position();

        let i = 0;

        each(group.get("tabs"), (x) => {
          if (x === tab) {
            ++i;
          }

          if (x.get("selected").get()) {
            $selected.push(x);

          } else {
            x.get("top").set(i);
            ++i;
          }
        });

        if ($selected.size === 0) {
          $selected.push(tab);
        }

        const tabs = group.get("tabs");

        // TODO is there a better way than using indexes ?
        const index = tab.get("index");

        // TODO hacky
        const height = ($selected.size === 1
                         ? tab_box.height
                         : (tab_box.height +
                            (Math["min"]($selected.size, 4) * 3)));

        const offset_x = (x - tab_box.left);
        const offset_y = (height / 2);

        // TODO a bit hacky
        if (tabs.has(index + 1)) {
          drag_info.set({
            group: group,
            tab: tabs.get(index + 1),
            height: height,
            direction: "up"
          });

        // TODO a bit hacky
        } else if (tabs.has(index - 1)) {
          drag_info.set({
            group: group,
            tab: tabs.get(index - 1),
            height: height,
            direction: "down"
          });

        } else {
          drag_info.set({
            group: group,
            tab: tab,
            height: height,
            direction: "up"
          });
        }


        $dragging.set({
          offset_x: offset_x,
          offset_y: offset_y,

          x: (x - offset_x),
          y: (y - offset_y),
          width: tab_box.width
        });

        each($selected, (tab) => {
          tab.get("visible").set(false);
        });
      },

      move: ({ x, y }) => {
        $dragging.modify(({ offset_x, offset_y, width }) => {
          // TODO hacky
          return {
            offset_x,
            offset_y,
            x: (x - offset_x),
            y: (y - offset_y),
            width
          };
        });
      },

      end: () => {
        move_tabs($selected, drag_info.get());

        each(indexed($selected), ([i, tab]) => {
          tab.get("visible").set(true);

          if (i !== 0) {
            tab.get("animate").set({
              from: style_hidden,
              to: style_visible,
              duration: 500,
              easing: ease_out
            });
          }
        });

        $selected.clear();

        drag_info.set(null);
        $dragging.set(null);

        /*const $group = $dragging.value.group;
        const $index = $dragging.value.index;

        const parent = placeholder.parent;

        console.log($group.get("id"), $dragging.value.index);

        // TODO assert that `parent[index] === placeholder`
        parent.remove($index);

        each(indexed(selected), ([i, tab]) => {
          const e = tab.get("ui").value;

          parent.insert($index + i, e);

          // TODO a little hacky
          e.style({
            "z-index": null
          }).run();

          if (i !== 0) {
            if (i < 5) {
              // TODO a little hacky
              merge([
                // TODO is this guaranteed to take 0 time ?
                // TODO is it guaranteed that separate animations synchronize together ?
                e.animate({ from: style_drag_stacked,
                            to: style_drag_normal,
                            duration: 0 }),
                e.animate({ from: style_hidden,
                            to: style_visible,
                            duration: 200 }),
              ]).run();

            } else {
              // TODO a little hacky
              e.animate({ from: style_hidden,
                          to: style_visible,
                          duration: 200 }).run();
            }
          }
        });

        group.value = $group;
        $dragging.value = null;*/
      }
    })
  ]);
