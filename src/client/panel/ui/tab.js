import * as dom from "../../dom";
import { List } from "../../../util/mutable/list";
import { url_bar } from "./url-bar";
import { latest, Ref, and, or, not, always } from "../../../util/mutable/ref";
import { each, indexed } from "../../../util/iterator";
import { move_tabs } from "../logic";


const $selected = new List();

const $dragging = new Ref(null);

export const drag_info = new Ref(null);

// TODO move this into another module
// TODO better implementation of this ?
const hypot = (x, y) =>
  Math["sqrt"](x * x + y * y);


const style_dragging = dom.style({
  "pointer-events": "none",
  "opacity": "0.98"
});

const style_tab = dom.style({
  "overflow": "hidden",

  "background-color": "inherit",

  "border-left-width": "1px",
  "border-right-width": "1px",
  "padding-left": "1px",
  "padding-right": "1px",
  "border-radius": "5px",

  "transition-property": "background-color",
  "transition-timing-function": "ease-in-out",
  "transition-duration": "100ms",

  //"transform-origin": "11px 50%",
  //"transform": "translate3d(0, 0, 0)", /* TODO this is a hack to make animation smoother, should replace with something else */

  "text-shadow": "0px 1px 1px " + dom.hsl(211, 61, 50, 0.1)
});

const style_unloaded = dom.style({
  "color": dom.hsl(0, 0, 30),
  "opacity": "0.75",
});

const style_focused = dom.style({
  "background-color": dom.hsl(30, 100, 94),
  "border-color":     dom.hsl(30, 100, 40),
  "transition-duration": "0ms",
});

const repeating = dom.repeating_gradient("-45deg",
                                         ["0px",  "transparent"],
                                         ["4px",  "transparent"],
                                         ["6px",  dom.hsl(0, 0, 100, 0.05)],
                                         ["10px", dom.hsl(0, 0, 100, 0.05)]);

const style_hover = dom.style({
  "cursor": "pointer",
  "font-weight": "bold",

  "z-index": "1",

  "transition-duration": "0ms",
  "background-image": dom.gradient("to bottom",
                                   ["0%",   dom.hsl(0, 0, 100, 0.2)],
                                   ["49%",  "transparent"          ],
                                   ["50%",  dom.hsl(0, 0,   0, 0.1)],
                                   ["80%",  dom.hsl(0, 0, 100, 0.1)],
                                   ["100%", dom.hsl(0, 0, 100, 0.2)]) + "," +
                      repeating,
  "box-shadow":       "1px 1px  1px " + dom.hsl(0, 0,   0, 0.25) + "," +
                "inset 0px 0px  3px " + dom.hsl(0, 0, 100, 1   ) + "," +
                "inset 0px 0px 10px " + dom.hsl(0, 0, 100, 0.25),
  "color": dom.hsl(211, 100, 99, 0.95),
  "background-color": dom.hsl(211, 100, 65),
  "border-color": dom.hsl(211, 38, 57),
  "text-shadow": "1px 0px 1px " + dom.hsl(211, 61, 50) + "," +
                 "0px 1px 1px " + dom.hsl(211, 61, 50)
});

const style_hold = dom.style({
  "padding-top": "2px",
  "padding-bottom": "0px",

  "background-position": "0px 1px",
  "background-image": dom.gradient("to bottom",
                                   ["0%",   dom.hsl(0, 0, 100, 0.2)  ],
                                   ["49%",  "transparent"            ],
                                   ["50%",  dom.hsl(0, 0,   0, 0.075)],
                                   ["80%",  dom.hsl(0, 0, 100, 0.1)  ],
                                   ["100%", dom.hsl(0, 0, 100, 0.2)  ]) + "," +
                      repeating,
  "box-shadow":       "1px 1px 1px "  + dom.hsl(0, 0,   0, 0.1) + "," +
                "inset 0px 0px 3px "  + dom.hsl(0, 0, 100, 0.9) + "," +
                "inset 0px 0px 10px " + dom.hsl(0, 0, 100, 0.225),
});

const style_selected = dom.style({
  "background-color": "green",
  "border-color": "black",

  // TODO code duplication
  "box-shadow":       "1px 1px  1px " + dom.hsl(0, 0,   0, 0.25) + "," +
                "inset 0px 0px  3px " + dom.hsl(0, 0, 100, 1   ) + "," +
                "inset 0px 0px 10px " + dom.hsl(0, 0, 100, 0.25),
});

const style_icon = dom.style({
  "height": "16px",
  "border-radius": "4px",
  "box-shadow": "0px 0px 15px " + dom.hsl(0, 0, 100, 0.9),
  "background-color": dom.hsl(0, 0, 100, 0.35)
});

const style_favicon = dom.style({
  "width": "16px"
});

const style_text = dom.style({
  "padding-left": "2px",
  "padding-right": "2px"
});

const style_close = dom.style({
  "width": "18px",
  "border-width": "1px",
  "padding-left": "1px",
  "padding-right": "1px"
});

const style_hidden = dom.style({
  /*"transform": {
    "rotationX": "-90deg", // 120deg
    "rotationY": "5deg", // 20deg
    //"rotationZ": "-1deg", // -1deg
  },*/

  "border-top-width": "0px",
  "border-bottom-width": "0px",
  "padding-top": "0px",
  "padding-bottom": "0px",
  "height": "0px",
  "opacity": "0"
});

const style_visible = dom.style({
  "border-top-width": "1px",
  "border-bottom-width": "1px",
  "padding-top": "1px",
  "padding-bottom": "1px",
  "height": "20px",
  "opacity": "1"
});

const style_drag_stacked = dom.style({
  "margin-top": "-18px"
});

const style_drag_normal = dom.style({
  "margin-top": "0px"
});

const favicon = (tab) =>
  dom.image((e) => [
    // TODO use setTimeout to fix a bug with Chrome ?
    e.url(tab.get("favicon")),

    e.style(style_icon, always(true)),
    e.style(style_favicon, always(true))
  ]);

const text = (tab) =>
  dom.stretch((e) => [
    e.style(style_text, always(true)),

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

    e.style(style_icon, always(true)),
    e.style(style_close, always(true)),

    e.visible(show)

    //e.style(ui_tab_close_style_hover,
    //  e.hovering()),

    //e.style(ui_tab_close_style_hold,
    //  and([
    //    e.hovering(),
    //    e.holding()
    //  ])),
  ]);

const ui_dragging_style = (e, index) => {
  if (index === 0) {
    // Do nothing

  } else if (index < 5) {
    return e.animate({ from: style_drag_normal,
                       to: style_drag_stacked,
                       duration: 500 });

  } else {
    return e.animate({ from: style_visible,
                       to: style_hidden,
                       duration: 500 });
  }
};

const ui_dragging = (tab, index) =>
  dom.row((e) => [
    e.style(style_tab, always(true)),
    e.style(style_visible, always(true)),
    e.style(style_selected, always(true)),
    e.style(style_hover, always(index === 0)),

    e.set_style("z-index", always(-index + "")),

    ui_dragging_style(e, index),

    e.children([
      favicon(tab),
      text(tab)
    ])
  ]);

const drag_style = (f) =>
  $dragging.map((info) => {
    if (info === null) {
      return "";
    } else {
      return f(info) + "px";
    }
  });

const dragging =
  dom.floating((e) => [
    e.style(style_dragging, always(true)),

    e.visible($dragging),

    e.children($selected.map((tab, index) =>
      ui_dragging(tab, index))),

    e.set_style("left", drag_style((info) => info.x)),
    e.set_style("top", drag_style((info) => info.y)),
    e.set_style("width", drag_style((info) => info.width))
  ]);

export const tab = (group, tab) =>
  dom.row((e) => [
    e.style(style_tab, always(true)),

    e.style(style_visible, always(true)),

    e.style(style_hover, and([
      not($dragging),
      e.hovering()
    ])),

    e.style(style_hold, and([
      not($dragging),
      e.hovering(),
      e.holding()
    ])),

    e.style(style_selected, tab.get("selected")),

    e.style(style_focused, tab.get("focused")),

    e.style(style_unloaded, tab.get("unloaded")),

    e.visible(tab.get("visible")),

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

    /*e.set_style("visibility", tab.get("visible").map((x) => {
      if (x) {
        return "";
      } else {
        return "hidden";
      }
    })),*/

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

    e.on_mouse_hover((hover) => {
      if (hover && drag_info.get()) {
        drag_info.modify((info) => {
          if (info.tab === tab) {
            return {
              group: info.group,
              tab: info.tab,
              height: info.height,
              direction: (info.direction === "up"
                           ? "down"
                           : "up")
            };

          } else if (info.group === group) {
            const tabs = group.get("tabs");

            // TODO inefficient
            const old_index = tabs.index_of(info.tab).get();
            const new_index = tabs.index_of(tab).get();

            if (old_index < new_index) {
              return {
                group: group,
                tab: tab,
                height: info.height,
                direction: "down"
              };

            } else {
              return {
                group: group,
                tab: tab,
                height: info.height,
                direction: "up"
              };
            }

          } else {
            return {
              group: group,
              tab: tab,
              height: info.height,
              direction: "up"
            };
          }
        });
      }
    }),

    e.set_style("transition", latest([
      drag_info,
    ], (dragging) => {
      if (dragging) {
        return "margin 100ms linear";
      } else {
        return "";
      }
    })),

    e.set_style("margin", drag_info.map((info) => {
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
        return "";
      }
    })),

    e.draggable({
      start_if: (start_x, start_y, { x, y, alt, ctrl, shift }) =>
        //false &&
        !alt && !ctrl && !shift &&
        hypot(start_x - x, start_y - y) > 5,

      start: ({ x, y }) => {
        each(group.get("tabs"), (tab) => {
          if (tab.get("selected").get()) {
            $selected.push(tab);
          }
        });

        if ($selected.size === 0) {
          $selected.push(tab);
        }

        const tabs = group.get("tabs");

        // TODO inefficient
        const index = tabs.index_of(tab).get();

        const tab_box = e.get_position();

        const offset_x = (x - tab_box.left);
        // TODO hacky
        const offset_y = ((tab_box.height +
                           (Math["min"]($selected.size, 4) * 2))
                          / 2);

        if (tabs.has(index + 1)) {
          drag_info.set({
            group: group,
            tab: tabs.get(index + 1),
            height: 30,
            direction: "up"
          });

        } else if (tabs.has(index - 1)) {
          drag_info.set({
            group: group,
            tab: tabs.get(index - 1),
            height: 30,
            direction: "down"
          });

        } else {
          drag_info.set({
            group: group,
            tab: tab,
            height: 30,
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

        each($selected, (tab) => {
          tab.get("visible").set(true);
        });

        //$selected.clear();

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
          e.set_style("z-index", "").run();

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
