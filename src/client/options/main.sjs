require("../../hubs")

@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:object" },
  { id: "sjs:sequence" },
  { id: "lib:extension/client" },
  { id: "lib:util/dom", name: "dom" },
  { id: "lib:util/util" },
  { id: "../options" }
])


var container_width = 512 // 1024 / 2


function opt(s) {
  return {
    observer: @opt.get(s),
    // TODO
    "default": @opt.getDefault(s)
  }
}

function toNum(x) {
  return +x
}

// TODO lib:util/util function for this
function copy(to, from, s) {
  to ..@setNew(s, from ..@get(s))
}


var preview_style = @dom.CSS(`
  border-width: 1px;
  border-radius: 5px;
  border-color: black;
  margin-top: 0.4em;
  margin-bottom: 7px;
  width: 100%;
  height: 200px;
`)

var close_button_style = @dom.CSS(`
  width: 14px;
  height: 14px;
`)

var popup_container_style = @dom.CSS(`
  width: ${container_width}px;
`)

var popup_inner_container_style = @dom.CSS(`
  width: 100%;
  height: ${(screen.height / screen.width) * container_width}px;
  border-width: 1px;
  border-color: black;
  background-color: black;
  margin-top: 5px;
  margin-bottom: 7px;
`)

// e.styles(dom.panel)
var popup_vertical_line_style = @dom.CSS(`
  left: 50%;
  top: 0px;
  width: 1px;
  height: 100%;
  background-color: red;
`)

// e.styles(dom.panel)
var popup_horizontal_line_style = @dom.CSS(`
  left: 0px;
  top: 50%;
  width: 100%;
  height: 1px;
  background-color: red
`)

var popup_popup_table_style = @dom.CSS(`
  width: 100%;
  height: 100%;
`)

var popup_popup_text_style = @dom.CSS(`
  text-align: center;
  vertical-align: middle;
`)

// e.styles(dom.panel)
var popup_width_container_style = @dom.CSS(`
  left: 50%;
  bottom: 2px;
`)

var popup_text_style = @dom.CSS(`
  font-weight: bold;
  font-size: 12px;
  text-shadow: ${@dom.textStroke("white", "1px")};
`)

// popup_text_style
var popup_width_text_style = @dom.CSS(`
  left: -50%;
`)

// e.styles(dom.panel)
var popup_height_container_style = @dom.CSS(`
  top: 50%;
  right: 3px;
`)

// popup_text_style
var popup_height_text_style = @dom.CSS(`
  top: calc(-0.5em - 1px);
`)

var popup_control_table_style = @dom.CSS(`
  margin-left: auto;
  margin-right: auto;
`)

// e.styles(dom.stretch)
var popup_control_text_style = @dom.CSS(`
  white-space: pre; /* TODO hacky */
  margin-right: 2px;
`)

var popup_control_cell_style = @dom.CSS(`
  text-align: right;
`)


document.body ..@dom.appendContent(@options.top([
  @options.category("Theme", [
    @options.checkbox(opt("theme.animation") ..@extend({
      text: "Animation enabled"
    })),

    @options.separator(),

    @dom.Div([
      "Color... ",

      @options.list(opt("theme.color") ..@extend({
        items: [{
          group: "Color",
          items: [
            { name: "Blue",   value: "blue"   },
            { name: "Green",  value: "green"  },
            { name: "Yellow", value: "yellow" },
            { name: "Orange", value: "orange" },
            { name: "Red",    value: "red"    },
            { name: "Purple", value: "purple" },
            { name: "Pink",   value: "pink"   }
          ]
        }, {
          group: "Grayscale",
          items: [
            { name: "Black", value: "black" },
            { name: "Grey",  value: "grey"  },
            { name: "White", value: "white" }
          ]
        }]
      }))
    ]) ..@dom.horizontal,

    @dom.Iframe(null, { src: "panel.html" }) ..preview_style
  ]),

  @options.category("Groups", [
    @options.header("Display groups:"),
    @options.indent([
      @options.radio(opt("groups.layout") ..@extend({
        items: [
          { name: "Vertically",   value: "vertical"   },
          { name: "Horizontally", value: "horizontal" },
          { name: "In a grid",    value: "grid"       }
        ]
      })),

      @options.vertical_space("2px"),

      @options.indent([
        @dom.Div([
          @options.textbox(opt("groups.layout.grid.column") ..@extend({
            width: "2em",
            type: "number",
            set: toNum
          })),

          "columns"
        ]) ..@dom.horizontal,

        @dom.Div([
          @options.textbox(opt("groups.layout.grid.row") ..@extend({
            width: "2em",
            type: "number",
            set: toNum
          })),

          "rows"
        ]) ..@dom.horizontal
      ])
    ])
  ]),

  @options.category("Tabs", [
    @dom.Div([
      "Sort tabs by... ",

      @options.list(opt("group.sort.type") ..@extend({
        items: [
          { name: "Group",   value: "group"   },
          { name: "Session", value: "session" },
          { separator: true },
          { name: "Focused", value: "focused" },
          { name: "Created", value: "created" },
          { separator: true },
          { name: "URL",     value: "url"     },
          { name: "Name",    value: "name"    }
        ]
      }))
    ]) ..@dom.horizontal,

    @options.separator(),

    @dom.Div([
      "Show the ",

      @dom.Img(null, { src: "data/images/button-close.png", alt: "close" }) ..close_button_style,

      " button on the ",

      @options.list(opt("tabs.close.location") ..@extend({
        items: [
          { name: "right", value: "right" },
          { name: "left",  value: "left"  }
        ]
      })),

      " side ",

      @options.list(opt("tabs.close.display") ..@extend({
        items: [
          { name: "while hovering", value: "hover" },
          //o.item("of the focused tab", "focused") TODO
          { name: "of every tab",   value: "every" }
        ]
      }))
    ]) ..@dom.horizontal,

    @options.separator(),

    @options.header("Click behavior:"),
    @options.indent([
      @options.radio(opt("tabs.click.type") ..@extend({
        items: [
          { name: "1 click to focus",                     value: "focus"        },
          { name: "1 click to select, 2 clicks to focus", value: "select-focus" }
        ]
      }))
    ]),

    @options.separator(),

    @options.checkbox(opt("tabs.close.duplicates") ..@extend({
      text: "Automatically close duplicate tabs"
    }))
  ]),

  @options.category("Popup", [
    @options.header("Open the popup with:"),
    @options.indent([
      @dom.Div([
        @options.checkbox(opt("popup.hotkey.ctrl") ..@extend({
          text: "Ctrl / ⌘"
        })),

        @options.horizontal_space("15px"),

        @options.checkbox(opt("popup.hotkey.shift") ..@extend({
          text: "Shift"
        })),

        @options.horizontal_space("12px"),

        @options.checkbox(opt("popup.hotkey.alt") ..@extend({
          text: "Alt"
        })),

        @options.horizontal_space("10px"),

        @options.textbox(opt("popup.hotkey.letter") ..@extend({
          width: "2em",
          set: function (x) {
            return x ..@upperCase()
          }
        }))
      ]) ..@dom.horizontal
    ]),

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

    @dom.Div([
      @dom.Div([
        "Open as a... ",

        @options.list(opt("popup.type") ..@extend({
          items: [
            { name: "bubble",  value: "bubble"  },
            { name: "sidebar", value: "sidebar" },
            { name: "popup",   value: "popup"   },
            { name: "tab",     value: "tab"     }
          ]
        })),

        @dom.Div() ..@dom.stretch,

        @options.button("Check monitor size", function () {
          @connection.command("check-monitor-size", null)
          alert("Success!")
        // TODO use @CSS
        }) ..@dom.Style("height: 20px")
      ]) ..@dom.horizontal
    ]) ..popup_container_style
  ]),

  @options.category("Counter", [
    @dom.Div([
      @options.checkbox(opt("counter.enabled") ..@extend({
        text: "Display a counter that shows how many tabs you have"
      })),

      @options.horizontal_space("1px"),

      @options.list(opt("counter.type") ..@extend({
        items: [
          { name: "in Chrome", value: "in-chrome" },
          { name: "in total",     value: "total"     }
        ]
      }))
    ]) ..@dom.horizontal
  ]),

  @options.category("User Data", [
    @dom.Div([
      @options.button("Export", function () {
        var s = @connection.command("db.export", null)

        @assert.ok(s != null)

        // TODO I don't like this
        var o = {}
        copy(o, s, "current.windows.array")
        copy(o, s, "options.user")
        copy(o, s, "options.cache")
        copy(o, s, "undo")
        copy(o, s, "version")

        var date = new Date().toISOString().slice(0, 10) // TODO is this slice a good idea ?

        @dom.saveFilePicker(JSON.stringify(o, null, 2), {
          type: "application/json",
          name: "Tab Organizer - User Data (#{date}).json"
        })
      }),

      @options.horizontal_space("10px"),

      @options.button("Import", function () {
        // TODO maybe use each.par ...?
        @dom.openFilePicker({ type: "application/json,.json", multiple: true }) ..@each(function (s) {
                                           // TODO
          @connection.command("db.import", JSON.parse(s))
        })

        // TODO make this into a non-blocking dialog ?
        alert("Success!")
      }),

      @options.horizontal_space("20px"),

      @options.button("Reset options to default", function () {
        // TODO display a dialog that lets the user choose which things to reset
        if (confirm("Are you sure?\n\nThis will reset all options to default.\n\nThis cannot be undone.\n\nThis does NOT reset tabs, windows, or macros.")) {
          @opt.reset()
          @cache.reset()
        }
      })
    ]) ..@dom.horizontal
  ]),
]))

console.info("main: finished")
