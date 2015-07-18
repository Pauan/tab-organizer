import * as dom from "../../dom";
import { url_bar } from "./url-bar";
import { merge, latest, empty, Ref, and, not, always } from "../../../util/stream";
import { each, indexed } from "../../../util/iterator";
import { Set } from "../../../util/immutable/set";


const $dragging = new Ref(false);

// TODO move this into another module
// TODO better implementation of this ?
const hypot = (x, y) =>
  Math["sqrt"](x * x + y * y);


const style_drag_hidden = dom.style({
  "margin-top": "-20px"
});

const style_drag_stacked = dom.style({
  "margin-top": "-18px"
});

const style_drag_normal = dom.style({
  "margin-top": "0px"
});

const style_dragging = dom.style({
  "pointer-events": "none",
  "opacity": "0.94"
});

const style_placeholder = dom.style({
  "visibility": "hidden"
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

const favicon = (tab) =>
  dom.image((e) =>
    merge([
      // TODO use setTimeout to fix a bug with Chrome ?
      e.url(tab.get("favicon")),

      e.style_always(style_icon),
      e.style_always(style_favicon)
    ]));

const text = (tab) =>
  dom.stretch((e) => {
    e.push(dom.text(latest([
      tab.get("title"),
      tab.get("url")
    ], (title, url) => title || url)));

    return e.style_always(style_text);
  });

const close = (tab, show) =>
  dom.image((e) =>
    merge([
      e.url(always("data/images/button-close.png")),

      e.style_always(style_icon),
      e.style_always(style_close),

      e.visible(show)

      //e.style(ui_tab_close_style_hover,
      //  e.hovering()),

      //e.style(ui_tab_close_style_hold,
      //  and([
      //    e.hovering(),
      //    e.holding()
      //  ])),
    ]));


const dragging =
  dom.floating((e) =>
    merge([
      e.style_always(style_dragging),
      e.visible($dragging)
    ]));

const placeholder =
  dom.row((e) =>
    merge([
      e.style_always(style_placeholder),
      e.visible($dragging)
    ]));

export const tab = (tab, init) =>
  dom.row((e) => {
    e.push(favicon(tab));

    e.push(text(tab));

    e.push(close(tab,
      and([
        not($dragging),
        e.hovering()
      ])));

    return merge([
      e.style_always(style_tab),
      e.style_always(style_visible),

      e.style(style_hover,
        and([
          not($dragging),
          e.hovering()
        ])),

      e.style(style_hold,
        and([
          not($dragging),
          e.hovering(),
          e.holding()
        ])),

      e.style(style_selected,
        tab.get("selected")),

      e.style(style_focused,
        tab.get("focused")),

      e.style(style_unloaded,
        tab.get("unloaded")),

      (init
        ? empty
        : e.animate({ from: style_hidden,
                      to: style_visible,
                      duration: 1000 })),

      latest([
        e.hovering(),
        $dragging,
        tab.get("url")
      ], (hover, dragging, url) => {
        if (hover && !dragging && url) {
          url_bar.value = {
            x: hover.x,
            y: hover.y,
            url: url
          };

        } else {
          url_bar.value = null;
        }
      }),

      e.on_left_click().map(({ shift, ctrl, alt }) => {
        if (!shift && !ctrl && !alt) {

        } else if (shift && !ctrl && !alt) {


        } else if (!shift && ctrl && !alt) {
          // TODO code duplication
          /*if (selected.value.has(e)) {
            selected.value = selected.value.remove(e);
          } else {
            selected.value = selected.value.insert(e);
          }*/
        }
      }),

      e.on_middle_click().map((e) => {
        console.log("middle click", e);
      }),

      e.on_right_click().map((e) => {
        console.log("right click", e);
      }),

      e.on_mouse_hover().keep((x) => x && $dragging.value).map(() => {
        const parent = e.parent;
        // TODO a bit inefficient
        const index = parent.index_of(e).get();

        if (placeholder.parent === parent || index === 0) {
          parent.insert(index, placeholder);
        } else {
          parent.insert(index + 1, placeholder);
        }
      }),

      /*e.drag({
        start_if: (start_x, start_y, { x, y, alt, ctrl, shift }) => {
          return !alt && !ctrl && !shift && hypot(start_x - x, start_y - y) > 5;
        },

        start: ({ y }) => {
          // TODO a bit inefficient
          const index   = e.parent.index_of(e).get();
          const tab_box = e.get_position();

          if (selected.value.size === 0) {
            selected.value = selected.value.insert(e);
          }


          e.parent.insert(index, tab_placeholder);

          let height = 0;
          let offset = 0;

          each(indexed(selected.value), ([i, e]) => {
            if (i === 0) {
              // TODO a bit hacky
              height += 20;
              offset += 10;

            } else {
              if (i < 5) {
                // TODO a bit hacky
                height += 2 + 1;
                offset += 1;

                e.animate({ from: ui_tab_drag_normal,
                            to: ui_tab_drag_stacked,
                            duration: 250 }).run();
              } else {
                e.animate({ from: ui_tab_drag_normal,
                            to: ui_tab_drag_hidden,
                            duration: 250 }).run();
              }

              // TODO hacky
              e._dom["style"]["z-index"] = -i + "";
            }

            dragging.push(e);
          });

          // TODO hacky
          tab_placeholder._dom["style"]["height"] = height + "px";

          dragging.left = tab_box.left;
          dragging.width = tab_box.width;
          dragging.top = y - offset;

          $dragging.value = true;

          return { offset };
        },

        move: (info, { y }) => {
          dragging.top = y - info.offset;
          return info;
        },

        end: (info) => {
          const parent = tab_placeholder.parent;
          // TODO a bit inefficient
          const index = parent.index_of(tab_placeholder).get();

          console.log(index);

          parent.remove(index);

          each(indexed(selected.value), ([i, e]) => {
            parent.insert(index + i, e);

            if (i !== 0) {
              if (i < 5) {
                e.animate({ from: ui_tab_drag_stacked,
                            to: ui_tab_drag_normal,
                            duration: 250 }).run();
              } else {
                e.animate({ from: ui_tab_drag_hidden,
                            to: ui_tab_drag_normal,
                            duration: 250 }).run();
              }

              // TODO hacky
              e._dom["style"]["z-index"] = "";
            }
          });

          selected.value = Set();
          $dragging.value = false;
        }
      })*/
    ]);
  });
