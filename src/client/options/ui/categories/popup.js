import * as dom from "../../../dom";
import { async } from "../../../../util/async";
import { fail } from "../../../../util/assert";
import { latest, always, Ref } from "../../../../util/ref";
import { map, entries } from "../../../../util/iterator";
import { uppercase } from "../../../../util/string";
import { chrome } from "../../../../common/globals";
import { category, row, text, separator, stretch, button,
         horizontal_space } from "../common";
import { init as init_textbox } from "../textbox";
import { init as init_dropdown } from "../dropdown";
import { init as init_options } from "../../../sync/options";


export const init = async([init_textbox,
                           init_dropdown,
                           init_options],
                          ({ textbox },
                           { dropdown },
                           { get: opt }) => {

  const percent = (x, y) =>
    (x / y) * 100;

  // TODO it's gross to hardcode this
  // TODO can I rely on this URL not changing ?
  const keyboard_shortcut_url = "chrome://extensions/configureCommands";

  const open_keyboard_url = () => {
    // TODO lib:extension module for handling async stuff like this ?
    chrome["tabs"]["getCurrent"]((tab) => {
      chrome["tabs"]["create"]({
        "url": keyboard_shortcut_url,
        "windowId": tab["windowId"],
        "openerTabId": tab["id"],
        "index": tab["index"] + 1
      });
    });
  };

  const style_link = dom.style({
    "cursor": always("auto"),
  });

  const ui_keyboard = () =>
    row([
      text("Click "),

      dom.link((e) => [
        // TODO a little bit hacky
        e.set_style(style_link, always(true)),

        e.target(always("_blank")),
        e.value(always("here")),
        e.url(always(keyboard_shortcut_url)),

        // TODO hacky, but needed to work around a security restriction in Chrome
        e.on_left_click(open_keyboard_url),
        e.on_middle_click(open_keyboard_url)
      ]),

      text(" to configure a keyboard shortcut for opening the popup"),
    ]);


  const container_width = 512; // 1024 / 2

  const style_popup = dom.style({
    "width": always(container_width + "px"),
    // TOOD should this use Math["round"] ?
    "height": always(Math["round"]((screen["height"] / screen["width"]) *
                                   container_width) + "px"),
    "border-width": always("1px"),
    "border-color": always("black"),
    "background-color": always("black"),
    "margin-top": always("5px"),
    "margin-bottom": always("7px")
  });

  const style_popup_screen = dom.style({
    "overflow": always("hidden"),

    "left": opt("screen.available.left").map((left) =>
              percent(left, screen["width"]) + "%"),

    "top": opt("screen.available.top").map((top) =>
             percent(top, screen["height"]) + "%"),

    "width": opt("screen.available.width").map((width) =>
               percent(width, screen["width"]) + "%"),

    "height": opt("screen.available.height").map((height) =>
                percent(height, screen["height"]) + "%"),
  });

  /*const style_popup_vertical_line = dom.style({
    "position": always("absolute"),
    "left": always("50%"),
    "top": always("0px"),
    "width": always("1px"),
    "height": always("100%"),
    "background-color": always(dom.hsl(0, 0, 90)),
  });

  const style_popup_horizontal_line = dom.style({
    "position": always("absolute"),
    "left": always("0px"),
    "top": always("50%"),
    "width": always("100%"),
    "height": always("1px"),
    "background-color": always(dom.hsl(0, 0, 90)),
  });*/

  const style_popup_text = dom.style({
    "position": always("absolute"),
    "left": always("4px"),
    "bottom": always("2px"),

    "font-weight": always("bold"),
    "font-size": always("12px"),
    "text-shadow": always(dom.text_stroke("white", "1px")),
  });

  const style_popup_item = dom.style({
    "position": always("absolute"),
    "overflow": always("hidden"),

    "border-width": always("1px"),
    "border-color": always(dom.hsl(211, 100, 10)),

    "align-items": always("center"),
    "justify-content": always("center"),
  });

  const style_popup_popup = dom.style({
    "background-color": always(dom.hsl(211, 100, 96)),

    "width": latest([
      opt("popup.type"),
      opt("screen.available.width"),
      opt("size.bubble.width"),
      opt("size.sidebar"),
      opt("size.sidebar.position"),
      opt("size.popup.width"),
      opt("size.panel.width")
    ], (type, width, bubble, sidebar, position, popup, panel) => {
      switch (type) {
      case "bubble":
        return percent(bubble, width) + "%";

      case "sidebar":
        switch (position) {
        case "top":
          return "100%";
        case "left":
          return percent(sidebar, width) + "%";
        case "right":
          return percent(sidebar, width) + "%";
        case "bottom":
          return "100%";
        default:
          fail();
        }

      case "popup":
        return percent(popup, width) + "%";

      case "panel":
        return percent(panel, width) + "%";

      case "tab":
        return "100%";

      default:
        fail();
      }
    }),

    "height": latest([
      opt("popup.type"),
      opt("screen.available.height"),
      opt("size.bubble.height"),
      opt("size.sidebar"),
      opt("size.sidebar.position"),
      opt("size.popup.height"),
      opt("size.panel.height")
    ], (type, height, bubble, sidebar, position, popup, panel) => {
      switch (type) {
      case "bubble":
        return percent(bubble, height) + "%";

      case "sidebar":
        switch (position) {
        case "top":
          return percent(sidebar, height) + "%";
        case "left":
          return "100%";
        case "right":
          return "100%";
        case "bottom":
          return percent(sidebar, height) + "%";
        default:
          fail();
        }

      case "popup":
        return percent(popup, height) + "%";

      case "panel":
        return percent(panel, height) + "%";

      case "tab":
        // Chrome's UI takes up 61 pixels at the top
        return (100 - percent(61, height)) + "%";

      default:
        fail();
      }
    }),

    "left": latest([
      opt("popup.type"),
      opt("screen.available.width"),
      opt("size.sidebar.position"),
      opt("size.popup.left"),
      opt("size.popup.width")
    ], (type, width, position, popup, popup_width) => {
      switch (type) {
      case "sidebar":
        if (position === "right") {
          return null;
        } else {
          return "0%";
        }

      case "popup":
        return ((popup * 100) -
                (percent(popup_width, width) * popup)) + "%";

      case "tab":
        return "0%";

      default:
        return null;
      }
    }),

    "right": latest([
      opt("popup.type"),
      opt("screen.available.width"),
      opt("size.sidebar.position")
    ], (type, width, position) => {
      switch (type) {
      case "bubble":
        // Bubbles are displayed 33px from the right of Chrome's window
        return percent(33, width) + "%";

      case "sidebar":
        if (position === "right") {
          return "0%";
        } else {
          return null;
        }

      case "panel":
        // Panels are displayed 24px from the right of Chrome's window
        return percent(24, width) + "%";

      default:
        return null;
      }
    }),

    "top": latest([
      opt("popup.type"),
      opt("screen.available.height"),
      opt("size.sidebar.position"),
      opt("size.popup.top"),
      opt("size.popup.height")
    ], (type, height, position, popup, popup_height) => {
      switch (type) {
      case "bubble":
        // Bubbles are displayed 64px from the top of Chrome's window
        return percent(64, height) + "%";

      case "sidebar":
        if (position === "bottom") {
          return null;
        } else {
          return "0%";
        }

      case "popup":
        return ((popup * 100) -
                (percent(popup_height, height) * popup)) + "%";

      case "tab":
        // Chrome's UI takes up 61 pixels at the top
        return percent(61, height) + "%";

      default:
        return null;
      }
    }),

    "bottom": latest([
      opt("popup.type"),
      opt("size.sidebar.position")
    ], (type, position) => {
      switch (type) {
      case "sidebar":
        if (position === "bottom") {
          return "0%";
        } else {
          return null;
        }

      case "panel":
        // Panels are displayed 0px from the bottom of Chrome's window
        return "0%";

      default:
        return null;
      }
    }),

    "border-radius": opt("popup.type").map((type) => {
      switch (type) {
      case "bubble":
        return "3px";
      case "panel":
        return "4px 4px 0px 0px";
      default:
        return null;
      }
    }),

    "box-shadow": opt("popup.type").map((type) => {
      switch (type) {
      case "bubble":
      case "panel":
      case "popup":
        return "1px 1px 1px " + dom.hsl(0, 0, 0, 0.5);
      default:
        return null;
      }
    })
  });

  const style_popup_chrome_position = dom.style({
    "left": latest([
      opt("popup.type"),
      opt("screen.available.width"),
      opt("size.sidebar"),
      opt("size.sidebar.position")
    ], (type, width, sidebar, position) => {
      switch (type) {
      case "sidebar":
        if (position === "left") {
          return percent(sidebar, width) + "%";
        } else {
          return "0%";
        }

      default:
        return "0%";
      }
    }),

    "top": latest([
      opt("popup.type"),
      opt("screen.available.height"),
      opt("size.sidebar"),
      opt("size.sidebar.position")
    ], (type, height, sidebar, position) => {
      switch (type) {
      case "sidebar":
        if (position === "top") {
          return percent(sidebar, height) + "%";
        } else {
          return "0%";
        }

      default:
        return "0%";
      }
    }),

    "width": latest([
      opt("popup.type"),
      opt("screen.available.width"),
      opt("size.sidebar"),
      opt("size.sidebar.position")
    ], (type, width, sidebar, position) => {
      switch (type) {
      case "sidebar":
        if (position === "left" || position === "right") {
          return (100 - percent(sidebar, width)) + "%";
        } else {
          return "100%";
        }

      default:
        return "100%";
      }
    }),

    "height": latest([
      opt("popup.type"),
      opt("screen.available.height"),
      opt("size.sidebar"),
      opt("size.sidebar.position")
    ], (type, height, sidebar, position) => {
      switch (type) {
      case "sidebar":
        if (position === "top" || position === "bottom") {
          return (100 - percent(sidebar, height)) + "%";
        } else {
          return "100%";
        }

      default:
        return "100%";
      }
    }),
  });

  const style_popup_chrome = dom.style({
    //"background-color": always(dom.hsl(0, 0, 90)),
    "background-color": always(dom.hsl(211, 13, 80)),
  });

  const style_popup_chrome_top = dom.style({
    "position": always("absolute"),
    //"background-color": always(dom.hsl(211, 13, 80)),

    // TODO code duplication
    "border-color": always(dom.hsl(211, 100, 10, 0.2)),
    "border-style": always("dashed"),

    "border-bottom-width": opt("popup.type").map((type) =>
                             (type === "tab"
                               ? null
                               : "1px")),

    // TODO is this correct? e.g. what about when "sidebar" is set to "top" ?
    "height": opt("screen.available.height").map((height) =>
                // Chrome's UI takes up 61 pixels at the top
                percent(61, height) + "%")
  });

  const ui_popup = () =>
    dom.parent((e) => [
      e.set_style(style_popup, always(true)),

      e.children([
        dom.parent((e) => [
          e.set_style(style_popup_screen, always(true)),

          e.children([
            dom.parent((e) => [
              e.set_style(dom.row, always(true)),
              e.set_style(style_popup_item, always(true)),
              e.set_style(style_popup_chrome, always(true)),
              e.set_style(style_popup_chrome_position, always(true)),

              e.children([
                text("Google Chrome")
              ])
            ]),

            dom.child((e) => [
              e.set_style(style_popup_chrome_top, always(true)),
              e.set_style(style_popup_chrome_position, always(true)),
            ]),

            dom.parent((e) => [
              e.set_style(dom.row, always(true)),
              e.set_style(style_popup_item, always(true)),
              e.set_style(style_popup_popup, always(true)),

              e.children([
                dom.text((e) => [
                  e.value(opt("popup.type").map((x) =>
                            // TODO function for this
                            uppercase(x[0]) + x["slice"](1)))
                ])
              ])
            ]),

            dom.text((e) => [
              e.set_style(style_popup_text, always(true)),

              e.value(latest([
                opt("screen.available.width"),
                opt("screen.available.height")
              ], (width, height) =>
                width + " × " + height + " px"))
            ]),
          ])
        ])
      ])
    ]);


  const style_controls_wrapper = dom.style({
    // TODO a little bit hacky
    "justify-content": always("center")
  });

  const style_controls_table = dom.style({
    "table-layout": always("fixed"),
    "overflow": always("hidden")
  });

  const style_controls_cell = dom.style({
    "text-align": always("right")
  });

  const style_controls_text = dom.style({
    "margin-right": always("2px")
  });

  const ui_controls = (o) => {
    return dom.parent((e) => [
      e.set_style(dom.row, always(true)),
      e.set_style(style_controls_wrapper, always(true)),

      // TODO a little bit hacky
      e.children(always(map(entries(o), ([key, value]) =>
        dom.table((e) => [
          e.set_style(style_controls_table, always(true)),

          e.style({
            // Only show the controls that match the type
            "width": opt("popup.type").map((type) =>
                       (type === key
                         ? null
                         : "0px"))
          }),

          // TODO a little bit hacky
          e.children(always(map(value, (row) =>
            dom.table_row((e) => [
              e.children(always(map(row, (cell) =>
                dom.table_cell((e) => [
                  e.set_style(style_controls_cell, always(true)),

                  e.children([cell])
                ]))))
            ]))))
        ]))))
    ]);
  };

  const ui_text = (text) =>
    dom.text((e) => [
      e.set_style(dom.stretch, always(true)),
      e.set_style(style_controls_text, always(true)),
      e.value(always(text))
    ]);

  const ui_textbox = (left, right, name, info) =>
    row([
      ui_text(left),
      textbox(name, info),
      text(right)
    ]);


  const popup_get = (s) =>
    Math["round"]((s * 200) - 100);

  const popup_set = (s) =>
    (s + 100) / 200;

  const ui = () =>
    category("Popup", [
      ui_keyboard(),

      separator(),

      row([
        text("Open as a... "),

        dropdown("popup.type", [
          { name: "Bubble",  value: "bubble"  },
          { name: "Panel",   value: "panel"   },
          { name: "Popup",   value: "popup"   },
          { name: "Sidebar", value: "sidebar" },
          { name: "Tab",     value: "tab"     }
        ]),

        stretch(),

        button("Check monitor size", {
          height: "20px",
          on_click: () => {
            console.log("clicked");
          }
        })
      ]),

      ui_popup(),

      ui_controls({
        "popup": [
          [ui_textbox("Left:", "%", "size.popup.left", {
             type: "number",
             width: "2em",
             get_value: popup_get,
             set_value: popup_set
           }),

           horizontal_space("20px"),

           ui_textbox("Width:", "px", "size.popup.width", {
             type: "number"
           })],

          [ui_textbox("Top:", "%", "size.popup.top", {
             type: "number",
             width: "2em",
             get_value: popup_get,
             set_value: popup_set
           }),

           horizontal_space("15px"),

           ui_textbox("Height:", "px", "size.popup.height", {
             type: "number"
           })]
        ],

        "bubble": [
          // TODO put a maximum on this? it seems to be (screen_width / 2) and (screen_height / 1.5)
          [ui_textbox("Width:", "px", "size.bubble.width", {
             type: "number"
           })],
          [ui_textbox("Height:", "px", "size.bubble.height", {
             type: "number"
           })]
        ],

        "panel": [
          // TODO put a maximum on this?
          [ui_textbox("Width:", "px", "size.panel.width", {
             type: "number"
           })],
          [ui_textbox("Height:", "px", "size.panel.height", {
             type: "number"
           })]
        ],

        "sidebar": [
          [ui_textbox("Size:", "px", "size.sidebar", {
             type: "number"
           }),

           horizontal_space("25px"),

           ui_text("Position: "),

           dropdown("size.sidebar.position", [
             { name: "Left",   value: "left"   },
             { name: "Right",  value: "right"  },
             { name: "Top",    value: "top"    },
             { name: "Bottom", value: "bottom" }
           ])]
        ],

        "tab": []
      })
    ]);


  return { ui };
});
