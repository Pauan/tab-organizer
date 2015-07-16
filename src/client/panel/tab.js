import * as dom from "../dom";
import { url } from "./url-bar";
import { concat, Stream, merge, latest, empty, Ref } from "../../util/stream";
import { each, indexed } from "../../util/iterator";
import { Set } from "../../util/immutable/set";


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
  "opacity": "0.75"
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

const repeating = dom.repeating_gradient("-45deg",
                                         ["0px",  "transparent"],
                                         ["4px",  "transparent"],
                                         ["6px",  dom.hsl(0, 0, 100, 0.05)],
                                         ["10px", dom.hsl(0, 0, 100, 0.05)]);

const ui_tab_style_hover = dom.style({
  "cursor": "pointer",
  "font-weight": "bold",

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

const ui_favicon = (tab) =>
  dom.image((e) => {
    e.add_style(ui_tab_icon_style);
    e.add_style(ui_tab_favicon_style);
    e.url = tab.get("favicon");
    return empty;
  });

const ui_text = (tab) =>
  dom.stretch((e) => {
    e.add_style(ui_tab_text_style);
    e.push(dom.text(tab.get("title") || tab.get("url")));
    return empty;
  });

const ui_close = (tab) =>
  dom.image((e) => {
    e.add_style(ui_tab_icon_style);
    e.add_style(ui_tab_close_style);

    e.url = "data/images/button-close.png";

    return latest([
      e.hovering(),
      e.holding()
    ]).map(([hover, hold]) => {
      //e.set_style(ui_tab_close_style_hover, hover);
      //e.set_style(ui_tab_close_style_hold, hold);
    });
  });


const tab_dragging =
  dom.floating((e) => {
    e.add_style(ui_tab_dragging);
    e.hide();
    return empty;
  });

const tab_placeholder =
  dom.row((e) => {
    e.add_style(ui_tab_placeholder);
    return empty;
  });

const selected = new Ref(Set());

const dragging = new Ref(false);

export const ui_tab = (tab, init) =>
  dom.row((e) => {
    e.add_style(ui_tab_style);
    e.add_style(ui_tab_style_visible);

    e.push(ui_favicon(tab));
    e.push(ui_text(tab));
    e.push(ui_close(tab));

    const random = Stream((send, error, complete) => {
      setTimeout(() => {
        complete();
      }, Math["random"]() * 2000);
    });

    return merge([
      (init
        ? empty
        : e.animate({ from: ui_tab_style_hidden,
                      to: ui_tab_style_visible,
                      duration: 1000 })),

      latest([
        e.hovering(),
        e.holding(),
        dragging
      ]).map(([hover, hold, dragging]) => {
        e.set_style(ui_tab_style_hover, !dragging && hover);
        e.set_style(ui_tab_style_hold, !dragging && hover && hold);
      }),

      latest([
        selected
      ]).map(([selected]) => {
        e.set_style(ui_tab_selected_style, selected.has(e));
      }),

      latest([
        e.hovering(),
        dragging
      ]).map(([hover, dragging]) => {
        if (hover && !dragging) {
          url.value = {
            x: hover.x,
            y: hover.y,
            url: tab.get("url")
          };

        } else {
          url.value = null;
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
        const index = parent.index_of(e).get();

        if (tab_placeholder.parent === parent || index === 0) {
          parent.insert(index, tab_placeholder);
        } else {
          parent.insert(index + 1, tab_placeholder);
        }
      }),

      e.drag({
        threshold: 10,

        start: ({ y }) => {
          const index   = e.parent.index_of(e).get();
          const tab_box = e.get_position();

          if (selected.value.size === 0) {
            selected.value = selected.value.insert(e);
          }

          dragging.value = true;


          e.parent.insert(index, tab_placeholder);

          each(indexed(selected.value), ([i, e]) => {
            if (i !== 0) {
              if (i < 5) {
                e._dom["style"]["margin-top"] = -(tab_box.height - 2) + "px";
              } else {
                e._dom["style"]["margin-top"] = -tab_box.height + "px";
              }

              e._dom["style"]["z-index"] = -i + "";
            }

            tab_dragging.push(e);
          });

          tab_dragging.left = tab_box.left;
          tab_dragging.width = tab_box.width;

          tab_dragging.show();

          const drag_box = tab_dragging.get_position();
          const offset   = drag_box.height / 2;

          tab_dragging.top = y - offset;
          tab_placeholder._dom["style"]["height"] = drag_box.height + "px";


          return { offset };
        },

        move: (info, { y }) => {
          tab_dragging.top = y - info.offset;
          return info;
        },

        end: (info) => {
          const parent = tab_placeholder.parent;
          const index = parent.index_of(tab_placeholder).get();

          console.log(index);

          parent.remove(index);

          each(indexed(selected.value), ([i, e]) => {
            console.log(e);
            parent.insert(index + i, e);
            e._dom["style"]["margin-top"] = "";
            e._dom["style"]["z-index"] = "";
          });

          tab_dragging.hide();

          selected.value = Set();
          dragging.value = false;
        }
      })
    ]);
  });
