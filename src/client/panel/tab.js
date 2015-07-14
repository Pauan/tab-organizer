import * as dom from "../dom";
import { concat, Stream, merge, latest, empty } from "../../util/stream";


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

  "cursor": "pointer",
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
    e.set_url(tab.get("favicon"));
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

    e.set_url("data/images/button-close.png");

    return latest([
      e.hovering,
      e.holding
    ]).map(([hover, hold]) => {
      //e.set_style(ui_tab_close_style_hover, hover);
      //e.set_style(ui_tab_close_style_hold, hold);
    });
  });

const tab_placeholder =
  dom.floating((e) => {
    //e.hide();
    return empty;
  });

export const ui_tab = (tab) =>
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
      latest([
        e.hovering,
        e.holding
      ]).map(([hover, hold]) => {
        e.set_style(ui_tab_style_hover, hover);
        e.set_style(ui_tab_style_hold, hover && hold);
      }),

      e.on_left_click().map((e) => {
        console.log("left click", e);
      }),

      e.on_middle_click().map((e) => {
        console.log("middle click", e);
      }),

      e.on_right_click().map((e) => {
        console.log("right click", e);
      }),

      /*e.drag_target({

      }),*/

      e.drag_source({
        threshold: 10,

        start: ({ y }) => {
          const box = e._dom["getBoundingClientRect"]();
          const offset = box["height"] / 2;

          const copy = e.copy();

          copy.add_style(ui_tab_style_hover);
          copy._dom["style"]["width"] = box["width"] + "px";

          e.add_style(ui_tab_dragging);

          tab_placeholder.set_top(y - offset);
          tab_placeholder.push(copy);
          tab_placeholder.show();

          return { offset };
        },

        move: (info, { y }) => {
          tab_placeholder.set_top(y - info.offset);
          return info;
        },

        end: (info) => {
          e.remove_style(ui_tab_dragging);

          tab_placeholder.clear();
          tab_placeholder.hide();
        }
      }),

      concat([
        random,

        e.animate({ from: ui_tab_style_visible,
                    to: ui_tab_style_hidden,
                    duration: 1000 }),

        random,

        e.animate({ from: ui_tab_style_hidden,
                    to: ui_tab_style_visible,
                    duration: 1000 }),

        // /[0-9]+(px)?/

        /*animate(1000).map(ease_in_out).map((t) => {
          if (t === 1) {
            e._dom.style["border-top-width"] = "";
            e._dom.style["border-bottom-width"] = "";
            e._dom.style["padding-top"] = "";
            e._dom.style["padding-bottom"] = "";
            e._dom.style["height"] = "";
            e._dom.style["opacity"] = "";

          } else {
            e._dom.style["border-top-width"] = round_range(t, 0, 1) + "px";
            e._dom.style["border-bottom-width"] = round_range(t, 0, 1) + "px";
            e._dom.style["padding-top"] = round_range(t, 0, 1) + "px";
            e._dom.style["padding-bottom"] = round_range(t, 0, 1) + "px";
            e._dom.style["height"] = round_range(t, 0, 20) + "px";
            e._dom.style["opacity"] = range(t, 0, 1) + "";
          }
        }),

        animate(1000).map(ease_in_out).map((t) => {
          if (t === 1) {
            e._dom.style["border-top-width"] = "";
            e._dom.style["border-bottom-width"] = "";
            e._dom.style["padding-top"] = "";
            e._dom.style["padding-bottom"] = "";
            e._dom.style["height"] = "";
            e._dom.style["opacity"] = "";

          } else {
            e._dom.style["border-top-width"] = round_range(t, 1, 0) + "px";
            e._dom.style["border-bottom-width"] = round_range(t, 1, 0) + "px";
            e._dom.style["padding-top"] = round_range(t, 1, 0) + "px";
            e._dom.style["padding-bottom"] = round_range(t, 1, 0) + "px";
            e._dom.style["height"] = round_range(t, 20, 0) + "px";
            e._dom.style["opacity"] = range(t, 1, 0) + "";
          }
        })*/
      ])//.forever()
    ]);
  });

/*animate(1000).map(ease_in_out).each((t) => {
  console.log(range(t, 0, 20));
});*/
