import * as dom from "../../dom";
import { url_bar } from "./url-bar";
import { latest, Ref, and, or, not, always } from "../../../util/mutable/ref";
import { each, indexed } from "../../../util/iterator";
//import { select_tab } from "../logic";


export const $dragging = new Ref(null);

// TODO move this into another module
// TODO better implementation of this ?
const hypot = (x, y) =>
  Math["sqrt"](x * x + y * y);


const style_dragging = dom.style({
  "pointer-events": "none",
  "opacity": "0.94"
});

const style_placeholder = dom.style({
  "visibility": "hidden"
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

  //"transform-origin": "11px 50%",
  //"transform": "translate3d(0, 0, 0)", /* TODO this is a hack to make animation smoother, should replace with something else */

  "text-shadow": "0px 1px 1px " + dom.hsl(211, 61, 50, 0.1),
  "transition-duration": "100ms"
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


const dragging =
  dom.floating((e) => [
    e.style(style_dragging, always(true)),
    e.visible($dragging)
  ]);

export const placeholder =
  dom.row((e) => [
    e.style(style_placeholder, always(true)),
    e.visible($dragging)
  ]);

export const tab = (tab) =>
  dom.row((e) => [
    e.style(style_tab, always(true)),

    e.style(style_visible, always(true)),

    e.style(style_hover, or([
      $dragging.map((dragging) =>
        dragging !== null && dragging.tab === tab),
      and([
        not($dragging),
        e.hovering()
      ])
    ])),

    e.style(style_hold, and([
      not($dragging),
      e.hovering(),
      e.holding()
    ])),

    e.style(style_selected, tab.get("selected")),

    e.style(style_focused, tab.get("focused")),

    e.style(style_unloaded, tab.get("unloaded")),

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
      if (!shift && !ctrl && !alt) {

      } else if (shift && !ctrl && !alt) {


      } else if (!shift && ctrl && !alt) {
        //select_tab(group.value, tab);
      }
    }),

    e.on_middle_click((e) => {
      console.log("middle click", e);
    }),

    e.on_right_click((e) => {
      console.log("right click", e);
    }),

    /*e.on_mouse_hover((hover) => {
      // TODO test this
      if (hover && $dragging.get()) {
        const parent = e.parent;

        // TODO a bit inefficient
        const index = parent.index_of(e).get();

        // TODO a bit hacky
        //if (!(placeholder.parent === parent || index === 0)) {
        //  ++index;
        //}

        $dragging.value.index = index;
        $dragging.value.group.value = group;

        parent.insert(index, placeholder);
      }
    }),*/

    /*e.draggable({
      start_if: (start_x, start_y, { x, y, alt, ctrl, shift }) =>
        //false &&
        !alt && !ctrl && !shift &&
        hypot(start_x - x, start_y - y) > 5,

      start: ({ x, y }) => {
        // TODO a bit inefficient
        const index   = e.parent.index_of(e).get();
        const tab_box = e.get_position();

        let selected = group.value.get("selected").value;

        // TODO hacky
        if (selected["length"] === 0) {
          selected = [tab];
        }


        e.parent.insert(index, placeholder);

        const offset_x = (x - tab_box.left);

        let height   = 0;
        let offset_y = 0;

        each(indexed(selected), ([i, tab]) => {
          const e = tab.get("ui").value;

          // TODO a little hacky
          e.set_style("z-index", -i + "").run();

          if (i === 0) {
            // TODO a bit hacky
            height += 20;
            offset_y += 10;

          } else {
            if (i < 5) {
              // TODO a bit hacky
              height += 2 + 1;
              offset_y += 1;

              // TODO a little hacky
              e.animate({ from: style_drag_normal,
                          to: style_drag_stacked,
                          duration: 200 }).run();

            } else {
              // TODO a little hacky
              e.animate({ from: style_visible,
                          to: style_hidden,
                          duration: 200 }).run();
            }
          }

          dragging.push(e);
        });

        // TODO a little hacky
        merge([
          placeholder.set_style("height", height + "px"),
          dragging.set_style("left", (x - offset_x) + "px"),
          dragging.set_style("top", (y - offset_y) + "px"),
          dragging.set_style("width", tab_box.width + "px"),
        ]).run();

        $dragging.value = {
          // TODO a bit hacky
          tab: selected[0],
          index: index,
          group: group
        };

        return { offset_x, offset_y, selected };
      },

      move: (info, { x, y }) => {
        if (true) {
          // TODO a little hacky
          dragging.set_style("left", (x - info.offset_x) + "px").run();
        }
        dragging.set_style("top", (y - info.offset_y) + "px").run();
        return info;
      },

      end: ({ selected }) => {
        const $group = $dragging.value.group;
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
        $dragging.value = null;
      }
    })*/
  ]);
