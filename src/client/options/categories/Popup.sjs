@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:object" },
  { id: "sjs:sequence" },
  { id: "lib:extension/client" },
  { id: "lib:util/dom" },
  { id: "lib:util/util" },
  { id: "lib:util/observe" },
  { id: "../util" },
  { id: "../../options", name: "top_options" }
])

var container_width = 512 // 1024 / 2

var changes = {
  screenBackground: "hsl(211, 13%, 55%)",
  popupBorder:      "hsl(211, 100%, 10%)",
  popupBackground:  "hsl(211, 100%, 96%)"
}

var popup_container_style = @CSS(`
  width: ${container_width}px;
`)

var popup_monitor_button_style = @CSS(`
  height: 20px;
`)

var popup_inner_container_style = @CSS(`
  width: 100%;
  height: ${(screen.height / screen.width) * container_width}px;
  border-width: 1px;
  border-color: black;
  background-color: black;
  margin-top: 5px;
  margin-bottom: 7px;
`)

var popup_vertical_line_style = @CSS(`
  left: 50%;
  top: 0px;
  width: 1px;
  height: 100%;
  background-color: red;
`)

var popup_horizontal_line_style = @CSS(`
  left: 0px;
  top: 50%;
  width: 100%;
  height: 1px;
  background-color: red;
`)

var popup_popup_style = @CSS(`
  border-width: 1px;
  border-color: ${changes.popupBorder};
  background-color: ${changes.popupBackground};
`)

var popup_popup_table_style = @CSS(`
  width: 100%;
  height: 100%;
`)

var popup_popup_text_style = @CSS(`
  text-align: center;
  vertical-align: middle;
`)

var popup_width_container_style = @CSS(`
  left: 50%;
  bottom: 2px;
`)

var popup_text_style = @CSS(`
  font-weight: bold;
  font-size: 12px;
  text-shadow: ${@text_stroke("white", "1px")};
`)

var popup_width_text_style = @CSS(`
  left: -50%;
`)

var popup_height_container_style = @CSS(`
  top: 50%;
  right: 3px;
`)

var popup_height_text_style = @CSS(`
  top: calc(-0.5em - 1px);
`)

var popup_control_table_style = @CSS(`
  margin-left: auto;
  margin-right: auto;
`)

var popup_control_text_style = @CSS(`
  white-space: pre; /* TODO hacky */
  margin-right: 2px;
`)

var popup_textbox_style = @CSS(`
  margin-left: 3px;
  margin-right: 3px;
`)

var popup_control_cell_style = @CSS(`
  text-align: right;
`)

var popup_screen_style = @CSS(`
  background-color: ${changes.screenBackground};
`)

function popup_width() {
  return @Div([
    // TODO retraction
    @Div() ..popup_text_style ..popup_width_text_style ..@Mechanism(function (elem) {
      @observe([@top_options.cache.get("screen.available.width")], function (x) {
        elem.textContent = "#{x} px"
      })
    })
  ]) ..popup_width_container_style ..@panel
}

// TODO code duplication with popup_width
function popup_height() {
  return @Div([
    // TODO retraction
    @Div() ..popup_text_style ..popup_height_text_style ..@Mechanism(function (elem) {
      @observe([@top_options.cache.get("screen.available.height")], function (x) {
        elem.textContent = "#{x} px"
      })
    })
  ]) ..popup_height_container_style ..@panel
}

function popup_popup() {
  return @Div([
    @Table([
      @TBody([
        @Tr([
          @Td() ..popup_popup_text_style ..@Mechanism(function (elem) {
            // TODO handle retraction
            @observe([@top_options.opt.get("popup.type")], function (type) {
              elem.textContent = type ..@upperCase()
            })
          })
        ])
      ])
    ]) ..popup_popup_table_style
  ])
    ..popup_popup_style
    ..@panel
    ..@clip
    // TODO retraction
    // TODO this should be in popup_popup_style
    ..@Mechanism(function (elem) {
      function convert(x, y) {
        return (x / y) * 100
      }

      /**
       * bubble
       */
      @observe([@top_options.opt.get("popup.type"),
                @top_options.cache.get("screen.available.width"),
                @top_options.cache.get("screen.available.height"),
                @top_options.opt.get("size.bubble.width"),
                @top_options.opt.get("size.bubble.height")], function (type, width, height, bubble_width, bubble_height) {
        if (type === "bubble") {
          // Bubbles are displayed 64px from the top of Chrome's window
          elem.style["top"]    = convert(64, height) + "%"
          elem.style["left"]   = ""
          // Bubbles are displayed 33px from the right of Chrome's window
          elem.style["right"]  = convert(33, width) + "%"
          elem.style["bottom"] = ""
          elem.style["width"]  = convert(bubble_width,  width)  + "%"
          elem.style["height"] = convert(bubble_height, height) + "%"
          elem.style["border-radius"] = "3px"
        }
      })

      /**
       * sidebar
       */
      @observe([@top_options.opt.get("popup.type"),
                @top_options.cache.get("screen.available.width"),
                @top_options.cache.get("screen.available.height"),
                @top_options.opt.get("size.sidebar"),
                @top_options.opt.get("size.sidebar.position")], function (type, width, height, size, position) {
        if (type === "sidebar") {
          if (position === "top") {
            elem.style["top"]    = "0%"
            elem.style["left"]   = "0%"
            elem.style["right"]  = ""
            elem.style["bottom"] = ""
            elem.style["width"]  = "100%"
            elem.style["height"] = convert(size, height) + "%"
            elem.style["border-radius"] = ""
          } else if (position === "left") {
            elem.style["top"]    = "0%"
            elem.style["left"]   = "0%"
            elem.style["right"]  = ""
            elem.style["bottom"] = ""
            elem.style["width"]  = convert(size, width) + "%"
            elem.style["height"] = "100%"
            elem.style["border-radius"] = ""
          } else if (position === "right") {
            elem.style["top"]    = "0%"
            elem.style["left"]   = ""
            elem.style["right"]  = "0%"
            elem.style["bottom"] = ""
            elem.style["width"]  = convert(size, width) + "%"
            elem.style["height"] = "100%"
            elem.style["border-radius"] = ""
          } else if (position === "bottom") {
            elem.style["top"]    = ""
            elem.style["left"]   = "0%"
            elem.style["right"]  = ""
            elem.style["bottom"] = "0%"
            elem.style["width"]  = "100%"
            elem.style["height"] = convert(size, height) + "%"
            elem.style["border-radius"] = ""
          } else {
            @assert.fail()
          }
        }
      })

      /**
       * popup
       */
      @observe([@top_options.opt.get("popup.type"),
                @top_options.cache.get("screen.available.width"),
                @top_options.cache.get("screen.available.height"),
                @top_options.opt.get("size.popup.left"),
                @top_options.opt.get("size.popup.top"),
                @top_options.opt.get("size.popup.width"),
                @top_options.opt.get("size.popup.height")], function (type, width, height, popup_left, popup_top, popup_width, popup_height) {
        if (type === "popup") {
          // -100 = (screen * 0)   - (width * 0)
          // 0    = (screen * 0.5) - (width * 0.5)
          // 100  = (screen * 1)   - (width * 1)
          elem.style["top"]    = ((popup_top  * 100) - (convert(popup_height, height) * popup_top))  + "%"
          elem.style["left"]   = ((popup_left * 100) - (convert(popup_width,  width)  * popup_left)) + "%"
          elem.style["right"]  = ""
          elem.style["bottom"] = ""
          elem.style["width"]  = convert(popup_width,  width)  + "%"
          elem.style["height"] = convert(popup_height, height) + "%"
          elem.style["border-radius"] = ""
        }
      })

      /**
       * tab
       */
      @observe([@top_options.opt.get("popup.type"),
                @top_options.cache.get("screen.available.height")], function (type, height) {
        if (type === "tab") {
          // Chrome's UI takes up 62 pixels at the top
          var top = convert(62, height)
          elem.style["top"]    = top + "%"
          elem.style["left"]   = "0%"
          elem.style["right"]  = ""
          elem.style["bottom"] = ""
          elem.style["width"]  = "100%"
          elem.style["height"] = (100 - top) + "%"
          elem.style["border-radius"] = ""
        }
      })
    })
}

function popup_screen() {
  return @Div([
    @Div([
      @Div() ..popup_vertical_line_style ..@panel,

      @Div() ..popup_horizontal_line_style ..@panel,

      popup_popup(),
      popup_width(),
      popup_height()
    ])
      ..popup_screen_style
      // TODO retraction
      // TODO this should be in popup_screen_style
      ..@Mechanism(function (elem) {
        @observe([@top_options.cache.get("screen.available.left")], function (left) {
          elem.style.left   = (left   / screen.width)  * 100 + "%"
        })

        @observe([@top_options.cache.get("screen.available.top")], function (top) {
          elem.style.top    = (top    / screen.height) * 100 + "%"
        })

        @observe([@top_options.cache.get("screen.available.width")], function (width) {
          elem.style.width  = (width  / screen.width)  * 100 + "%"
        })

        @observe([@top_options.cache.get("screen.available.height")], function (height) {
          elem.style.height = (height / screen.height) * 100 + "%"
        })
      })
  ]) ..popup_inner_container_style
}

function popup_text(s) {
  return @Div(s) ..popup_control_text_style ..@stretch
}

function popup_control_textbox(l, r, info) {
  return @Div([
    popup_text(l),
    @options.textbox(info) ..popup_textbox_style,
    r
  ]) ..@horizontal
}

function popup_control_cells(input) {
  var cells = input ..@map(function (input) {
    return @Td(input) ..popup_control_cell_style
  })
  return @Tr(cells)
}


var popup_control_maxheight = 0

function popup_control(s, input) {
  return @Table(@TBody(input))
    ..popup_control_table_style
    // TODO retraction
    ..@Mechanism(function (elem) {
      // TODO a little bit hacky
      var height = elem.getBoundingClientRect().height
      popup_control_maxheight = Math.max(popup_control_maxheight, height)

      @observe([@top_options.opt.get("popup.type")], function (type) {
        // Only show the controls that match the type
        elem.hidden = (type !== s)
      })
    })
}

function popup_controls(input) {
  // TODO do child Mechanisms always fire before parent Mechanisms?
  return @Div(input) ..@Mechanism(function (elem) {
    // TODO a little bit hacky
    elem.style.height = "#{popup_control_maxheight}px"
  })
}


function popup_get(s) {
  return Math.round((s * 200) - 100)
}

function popup_set(s) {
  return (@toNum(s) + 100) / 200
}


exports.top = function () {
  // TODO it's gross to hardcode this
  // TODO can I rely on this URL not changing ?
  var keyboard_shortcut_url = "chrome://extensions/configureCommands"

  return @options.category("Popup", [
    @Div([
      "Configure a keyboard shortcut for opening the popup ",

      // TODO retraction
      @A("here", { target: "_blank", href: keyboard_shortcut_url }) ..@Mechanism(function (elem) {
        // TODO use built-ins
        // TODO hacky, but needed to work around a security restriction in Chrome
        elem.addEventListener("click", function (e) {
          e.preventDefault()
          chrome.tabs.create({ url: keyboard_shortcut_url })
        }, true)
      }),

      /*@options.checkbox(@opt("popup.hotkey.ctrl") ..@extend({
        text: "Ctrl / ⌘"
      })),

      @options.horizontal_space("15px"),

      @options.checkbox(@opt("popup.hotkey.shift") ..@extend({
        text: "Shift"
      })),

      @options.horizontal_space("12px"),

      @options.checkbox(@opt("popup.hotkey.alt") ..@extend({
        text: "Alt"
      })),

      @options.horizontal_space("10px"),

      @options.textbox(@opt("popup.hotkey.letter") ..@extend({
        width: "2em",
        set: function (x) {
          return x ..@upperCase()
        }
      }))*/
    ]) ..@horizontal,

    /*@options.separator(),

    dom.box(function (e) {
      e.styles(dom.horiz)

      util.options.list(e, "popup.switch.action", function (o) {
        o.item("Minimize", "minimize")
        o.item("Close", "close")
        o.item("Show", "show")
      })

      dom.box(function (e) {
        e.text(" the popup ")
      }).move(e)

      util.options.list(e, "popup.close.when", function (o) {
        o.item("when switching tabs", "switch-tab")
        o.item("when switching windows", "switch-window")
        o.item("when losing focus", "lose-focus")
      })
    }).move(e)*/

    /*util.options.separator(e)

    util.options.checkbox(e, "popup.close.escape", "Use the Escape key to close the popup")*/

    @options.separator(),

    @Div([
      @Div([
        "Open as a... ",

        @options.list(@opt("popup.type") ..@extend({
          items: [
            { name: "bubble",  value: "bubble"  },
            { name: "sidebar", value: "sidebar" },
            { name: "popup",   value: "popup"   },
            { name: "tab",     value: "tab"     }
          ]
        })),

        @Div() ..@stretch,

        @options.button("Check monitor size", function () {
          @connection.command("check-monitor-size", null)
          alert("Success!")
        }) ..popup_monitor_button_style
      ]) ..@horizontal,

      popup_screen(),

      popup_controls([
        popup_control("popup", [
          popup_control_cells([
            popup_control_textbox("Left:", "%", @opt("size.popup.left") ..@extend({
              type: "number",
              width: "2em",
              get: popup_get,
              set: popup_set
            })),

            @options.horizontal_space("15px"),

            popup_control_textbox("Width:", "px", @opt("size.popup.width") ..@extend({
              type: "number",
              set: @toNum
            }))
          ]),

          popup_control_cells([
            popup_control_textbox("Top:", "%", @opt("size.popup.top") ..@extend({
              type: "number",
              width: "2em",
              get: popup_get,
              set: popup_set
            })),

            @options.horizontal_space("15px"),

            popup_control_textbox("Height:", "px", @opt("size.popup.height") ..@extend({
              type: "number",
              set: @toNum
            }))
          ])
        ]),

        popup_control("bubble", [
          popup_control_cells([
            popup_control_textbox("Width:", "px", @opt("size.bubble.width") ..@extend({
              type: "number",
              set: @toNum
            }))
          ]),

          popup_control_cells([
            popup_control_textbox("Height:", "px", @opt("size.bubble.height") ..@extend({
              type: "number",
              set: @toNum
            }))
          ])
        ]),

        popup_control("sidebar", [
          popup_control_cells([
            popup_control_textbox("Size:", "px", @opt("size.sidebar") ..@extend({
              type: "number",
              set: @toNum
            })),

            @options.horizontal_space("25px"),

            popup_text("Position: "),

            @options.list(@opt("size.sidebar.position") ..@extend({
              items: [
                { name: "Left",   value: "left"   },
                { name: "Right",  value: "right"  },
                { name: "Top",    value: "top"    },
                { name: "Bottom", value: "bottom" }
              ]
            }))
          ])
        ]),

        popup_control("tab")
      ])
    ]) ..popup_container_style

  ])
}
