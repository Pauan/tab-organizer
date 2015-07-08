import * as dom from "../dom";


const ui_tab_style_hidden = dom.animation({
  duration: 1000,
  style: {
    "rotationX": "-90deg", // 120deg
    "rotationY": "5deg", // 20deg
    //"rotationZ": "-1deg", // -1deg

    "border-top-width": "0px",
    "border-bottom-width": "0px",
    "padding-top": "0px",
    "padding-bottom": "0px",
    "height": "0px",
    "opacity": "0"
  }
});

const ui_tab_style = dom.style({
  "border-width": "1px",
  "padding": "1px",
  "height": "20px",
  "border-radius": "5px",

  "cursor": "pointer",
  "transition-property": "background-color",
  "transition-timing-function": "ease-in-out",

  "transform-origin": "11px 50%",
  "transform": "translate3d(0, 0, 0)", /* TODO this is a hack to make animation smoother, should replace with something else */

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
  dom.image({ style: ui_tab_icon_style,
              url: tab.get("favicon") });

const ui_text = (tab) =>
  dom.stretch({ style: ui_tab_text_style }, [
    dom.text(tab.get("title") || tab.get("url"))
  ]);

const ui_close = (tab) =>
  dom.image({ style: ui_tab_close_style,
              style_hover: ui_tab_close_style_hover,
              style_hold: ui_tab_close_style_hold,
              url: "data/images/button-close.png" });

export const ui_tab = (id) =>
  new dom.Component(db.ref(["current.tab-ids", id]), (tab) => {
    dom.row({ style: ui_tab_style,
              style_hover: ui_tab_style_hover,
              style_hold: ui_tab_style_hold,

              animate_add: ui_tab_style_hidden,
              animate_remove: ui_tab_style_hidden },
      (options["tab-side"] === "left"
        ? [ui_favicon(tab), ui_text(tab), ui_close(tab)]
        : [ui_close(tab), ui_text(tab), ui_favicon(tab)]))
  });
