import * as dom from "../../../../util/dom";
import * as list from "../../../../util/list";
import * as record from "../../../../util/record";
import * as async from "../../../../util/async";
import * as ref from "../../../../util/ref";
import * as string from "../../../../util/string";
import { uuid_port_popup } from "../../../../common/uuid";
import { ports } from "../../../../chrome/client";
import { fail } from "../../../../util/assert";
import { category, row, text, separator, stretch, button,
         horizontal_space } from "../common";
import { init as init_textbox } from "../textbox";
import { init as init_dropdown } from "../dropdown";
import { init as init_options } from "../../../sync/options";


export const init = async.all([init_textbox,
                               init_dropdown,
                               init_options],
                              ({ textbox },
                               { dropdown },
                               { get: opt }) => {

  const percent = (x, y) =>
    (x / y) * 100;


  const container_width = 512; // 1024 / 2

  const style_popup = dom.make_style({
    "width": ref.always(container_width + "px"),
    // TOOD should this use Math["round"] ?
    "height": ref.always(Math["round"]((record.get(screen, "height") /
                                        record.get(screen, "width")) *
                                       container_width) + "px"),
    "border-width": ref.always("1px"),
    "border-color": ref.always("black"),
    "background-color": ref.always("black"),
    "margin-top": ref.always("5px"),
    "margin-bottom": ref.always("7px")
  });

  const style_popup_screen = dom.make_style({
    "overflow": ref.always("hidden"),

    "left": ref.map(opt("screen.available.left"), (left) =>
              percent(left, record.get(screen, "width")) + "%"),

    "top": ref.map(opt("screen.available.top"), (top) =>
             percent(top, record.get(screen, "height")) + "%"),

    "width": ref.map(opt("screen.available.width"), (width) =>
               percent(width, record.get(screen, "width")) + "%"),

    "height": ref.map(opt("screen.available.height"), (height) =>
                percent(height, record.get(screen, "height")) + "%"),
  });

  /*const style_popup_vertical_line = dom.make_style({
    "position": ref.always("absolute"),
    "left": ref.always("50%"),
    "top": ref.always("0px"),
    "width": ref.always("1px"),
    "height": ref.always("100%"),
    "background-color": ref.always(dom.hsl(0, 0, 90)),
  });

  const style_popup_horizontal_line = dom.make_style({
    "position": ref.always("absolute"),
    "left": ref.always("0px"),
    "top": ref.always("50%"),
    "width": ref.always("100%"),
    "height": ref.always("1px"),
    "background-color": ref.always(dom.hsl(0, 0, 90)),
  });*/

  const style_popup_text = dom.make_style({
    "position": ref.always("absolute"),
    "left": ref.always("4px"),
    "bottom": ref.always("2px"),

    "font-weight": ref.always("bold"),
    "font-size": ref.always("12px"),
    "text-shadow": ref.always(dom.text_stroke("white", "1px")),
  });

  const style_popup_item = dom.make_style({
    "position": ref.always("absolute"),
    "overflow": ref.always("hidden"),

    "border-width": ref.always("1px"),
    "border-color": ref.always(dom.hsl(211, 100, 10)),

    "align-items": ref.always("center"),
    "justify-content": ref.always("center"),
  });

  const style_popup_popup = dom.make_style({
    "background-color": ref.always(dom.hsl(211, 100, 96)),

    "width": ref.latest([
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

    "height": ref.latest([
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

    "left": ref.latest([
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

    "right": ref.latest([
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

    "top": ref.latest([
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

    "bottom": ref.latest([
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

    "border-radius": ref.map(opt("popup.type"), (type) => {
      switch (type) {
      case "bubble":
        return "3px";
      case "panel":
        return "4px 4px 0px 0px";
      default:
        return null;
      }
    }),

    "box-shadow": ref.map(opt("popup.type"), (type) => {
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

  const style_popup_chrome_position = dom.make_style({
    "left": ref.latest([
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

    "top": ref.latest([
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

    "width": ref.latest([
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

    "height": ref.latest([
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

  const style_popup_chrome = dom.make_style({
    //"background-color": ref.always(dom.hsl(0, 0, 90)),
    "background-color": ref.always(dom.hsl(211, 13, 80)),
  });

  const style_popup_chrome_top = dom.make_style({
    "position": ref.always("absolute"),
    //"background-color": ref.always(dom.hsl(211, 13, 80)),

    // TODO code duplication
    "border-color": ref.always(dom.hsl(211, 100, 10, 0.2)),
    "border-style": ref.always("dashed"),

    "border-bottom-width": ref.map(opt("popup.type"), (type) =>
                             (type === "tab"
                               ? null
                               : "1px")),

    // TODO is this correct? e.g. what about when "sidebar" is set to "top" ?
    "height": ref.map(opt("screen.available.height"), (height) =>
                // Chrome's UI takes up 61 pixels at the top
                percent(61, height) + "%")
  });

  const ui_popup = () =>
    dom.parent((e) => [
      dom.add_style(e, style_popup),

      dom.children(e, [
        dom.parent((e) => [
          dom.add_style(e, style_popup_screen),

          dom.children(e, [
            dom.parent((e) => [
              dom.add_style(e, dom.row),
              dom.add_style(e, style_popup_item),
              dom.add_style(e, style_popup_chrome),
              dom.add_style(e, style_popup_chrome_position),

              dom.children(e, [
                text("Google Chrome")
              ])
            ]),

            dom.child((e) => [
              dom.add_style(e, style_popup_chrome_top),
              dom.add_style(e, style_popup_chrome_position),
            ]),

            dom.parent((e) => [
              dom.add_style(e, dom.row),
              dom.add_style(e, style_popup_item),
              dom.add_style(e, style_popup_popup),

              dom.children(e, [
                dom.text((e) => [
                  dom.set_value(e, ref.map(opt("popup.type"), (x) =>
                                     // TODO function for this
                                     string.uppercase(x[0]) + string.slice(x, 1)))
                ])
              ])
            ]),

            dom.text((e) => [
              dom.add_style(e, style_popup_text),

              dom.set_value(e, ref.latest([
                opt("screen.available.width"),
                opt("screen.available.height")
              ], (width, height) =>
                width + " × " + height + " px"))
            ]),
          ])
        ])
      ])
    ]);


  const style_controls_wrapper = dom.make_style({
    // TODO a little bit hacky
    "justify-content": ref.always("center")
  });

  const style_controls_table = dom.make_style({
    "table-layout": ref.always("fixed"),
    "overflow": ref.always("hidden")
  });

  const style_controls_cell = dom.make_style({
    "text-align": ref.always("right")
  });

  const style_controls_text = dom.make_style({
    "margin-right": ref.always("2px")
  });

  const ui_controls = (o) => {
    const children = list.make();

    record.each(o, (key, value) => {
      list.push(children, dom.table((e) => [
        dom.add_style(e, style_controls_table),

        dom.style(e, {
          // Only show the controls that match the type
          "width": ref.map(opt("popup.type"), (type) =>
                     (type === key
                       ? null
                       : "0px"))
        }),

        // TODO a little bit hacky
        dom.children(e, list.map(value, (row) =>
          dom.table_row((e) => [
            dom.children(e, list.map(row, (cell) =>
              dom.table_cell((e) => [
                dom.add_style(e, style_controls_cell),

                dom.children(e, [cell])
              ])))
          ])))
      ]));
    });

    return dom.parent((e) => [
      dom.add_style(e, dom.row),
      dom.add_style(e, style_controls_wrapper),
      dom.children(e, children)
    ]);
  };

  const ui_text = (text) =>
    dom.text((e) => [
      dom.add_style(e, dom.stretch),
      dom.add_style(e, style_controls_text),
      dom.set_value(e, ref.always(text))
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


  const port = ports.open(uuid_port_popup);

  const handle_events = record.make({
    "set-monitor-size": () => {
      alert("Success!");
    }
  });

  ports.on_receive(port, (x) => {
    record.get(handle_events, record.get(x, "type"))();
  });


  const ui = () =>
    category("Popup", [
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
            ports.send(port, record.make({
              "type": "get-monitor-size"
            }));
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


  return async.done({ ui });
});
