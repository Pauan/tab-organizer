import * as dom from "../dom";
import { url_bar } from "./url-bar";
import { merge, latest, empty, Ref, and, not } from "../../util/stream";
import { each, indexed } from "../../util/iterator";
import { Set } from "../../util/immutable/set";


const ui_tab_drag_hidden = dom.style({
  "margin-top": "-20px"
});

const ui_tab_drag_stacked = dom.style({
  "margin-top": "-18px"
});

const ui_tab_drag_normal = dom.style({
  "margin-top": "0px"
});

const ui_tab_style_hidden = dom.style({
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

const ui_tab_dragging = dom.style({
  "pointer-events": "none",
  "opacity": "0.94"
});

const ui_tab_placeholder = dom.style({
  "visibility": "hidden"
});

const ui_tab_style_visible = dom.style({
  "border-top-width": "1px",
  "border-bottom-width": "1px",
  "padding-top": "1px",
  "padding-bottom": "1px",
  "height": "20px",
  "opacity": "1"
});

const ui_tab_style = dom.style({
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

const ui_tab_style_unloaded = dom.style({
  "color": dom.hsl(0, 0, 30),
  "opacity": "0.75",
});

const ui_tab_style_focused = dom.style({
  "background-color": dom.hsl(30, 100, 94),
  "border-color":     dom.hsl(30, 100, 40),
  "transition-duration": "0ms",
});

const repeating = dom.repeating_gradient("-45deg",
                                         ["0px",  "transparent"],
                                         ["4px",  "transparent"],
                                         ["6px",  dom.hsl(0, 0, 100, 0.05)],
                                         ["10px", dom.hsl(0, 0, 100, 0.05)]);

const ui_tab_style_hover = dom.style({
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

const ui_tab_style_hold = dom.style({
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

const ui_tab_selected_style = dom.style({
  "background-color": "green",
  "border-color": "black",

  // TODO code duplication
  "box-shadow":       "1px 1px  1px " + dom.hsl(0, 0,   0, 0.25) + "," +
                "inset 0px 0px  3px " + dom.hsl(0, 0, 100, 1   ) + "," +
                "inset 0px 0px 10px " + dom.hsl(0, 0, 100, 0.25),
});

const ui_tab_icon_style = dom.style({
  "height": "16px",
  "border-radius": "4px",
  "box-shadow": "0px 0px 15px " + dom.hsl(0, 0, 100, 0.9),
  "background-color": dom.hsl(0, 0, 100, 0.35)
});

const ui_tab_favicon_style = dom.style({
  "width": "16px"
});

const ui_tab_text_style = dom.style({
  "padding-left": "2px",
  "padding-right": "2px"
});

const ui_tab_close_style = dom.style({
  "width": "18px",
  "border-width": "1px",
  "padding-left": "1px",
  "padding-right": "1px"
});

const ui_favicon = (db, tab_id) =>
  dom.image((e) => {
    return merge([
      db.ref(["current.tab-ids", tab_id, "favicon"]).map((favicon) => {
        e.url = favicon;
      }),

      e.style_always(ui_tab_icon_style),
      e.style_always(ui_tab_favicon_style)
    ]);
  });

const ui_text = (db, tab_id) =>
  dom.stretch((e) => {
    e.push(dom.text(latest([
      db.ref(["current.tab-ids", tab_id, "title"]),
      db.ref(["current.tab-ids", tab_id, "url"])
    ], (title, url) => {
      return title || url;
    })));

    return e.style_always(ui_tab_text_style);
  });

const ui_close = (top, db, tab_id) =>
  dom.image((e) => {
    e.url = "data/images/button-close.png";

    return merge([
      e.style_always(ui_tab_icon_style),
      e.style_always(ui_tab_close_style),

      e.visible(and([
        not(dragging),
        top.hovering()
      ]))

      //e.style(ui_tab_close_style_hover,
      //  e.hovering()),

      //e.style(ui_tab_close_style_hold,
      //  and([
      //    e.hovering(),
      //    e.holding()
      //  ])),
    ]);
  });


const tab_dragging =
  dom.floating((e) => {
    e.hide();

    return e.style_always(ui_tab_dragging);
  });

const tab_placeholder =
  dom.row((e) => {
    return e.style_always(ui_tab_placeholder);
  });

const selected = new Ref(Set());

const dragging = new Ref(false);

// TODO move this into another module
// TODO better implementation of this ?
const hypot = (x, y) =>
  Math["sqrt"](x * x + y * y);

export const ui_tab = (db, tab_id, init) =>
  dom.row((e) => {
    e.push(ui_favicon(db, tab_id));
    e.push(ui_text(db, tab_id));
    e.push(ui_close(e, db, tab_id));

    return merge([
      e.style_always(ui_tab_style),
      e.style_always(ui_tab_style_visible),

      e.style(ui_tab_style_hover,
        and([
          not(dragging),
          e.hovering()
        ])),

      e.style(ui_tab_style_hold,
        and([
          not(dragging),
          e.hovering(),
          e.holding()
        ])),

      e.style(ui_tab_selected_style,
        // TODO a bit inefficient
        selected.map((selected) => selected.has(e))),

      /*e.style(ui_tab_style_focused,
        db.ref(["transient.tab-ids", tab_id, "focused"])),

      e.style(ui_tab_style_unloaded,
        db.ref(["transient.tab-ids", tab_id, "unloaded"])),*/

      (init
        ? empty
        : e.animate({ from: ui_tab_style_hidden,
                      to: ui_tab_style_visible,
                      duration: 1000 })),

      latest([
        e.hovering(),
        dragging,
        db.ref(["current.tab-ids", tab_id, "url"])
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
          if (selected.value.has(e)) {
            selected.value = selected.value.remove(e);
          } else {
            selected.value = selected.value.insert(e);
          }
        }
      }),

      e.on_middle_click().map((e) => {
        console.log("middle click", e);
      }),

      e.on_right_click().map((e) => {
        console.log("right click", e);
      }),

      e.on_mouse_hover().keep((x) => x && dragging.value).map(() => {
        const parent = e.parent;
        // TODO a bit inefficient
        const index = parent.index_of(e).get();

        if (tab_placeholder.parent === parent || index === 0) {
          parent.insert(index, tab_placeholder);
        } else {
          parent.insert(index + 1, tab_placeholder);
        }
      }),

      e.drag({
        start_if: (start_x, start_y, { x, y, alt, ctrl, shift }) => {
          return !alt && !ctrl && !shift && hypot(start_x - x, start_y - y) > 5
        },

        start: ({ y }) => {
          // TODO a bit inefficient
          const index   = e.parent.index_of(e).get();
          const tab_box = e.get_position();

          if (selected.value.size === 0) {
            selected.value = selected.value.insert(e);
          }

          dragging.value = true;


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

            tab_dragging.push(e);
          });

          // TODO hacky
          tab_placeholder._dom["style"]["height"] = height + "px";

          tab_dragging.left = tab_box.left;
          tab_dragging.width = tab_box.width;
          tab_dragging.top = y - offset;

          tab_dragging.show();


          return { offset };
        },

        move: (info, { y }) => {
          tab_dragging.top = y - info.offset;
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

          tab_dragging.hide();

          selected.value = Set();
          dragging.value = false;
        }
      })
    ]);
  });
