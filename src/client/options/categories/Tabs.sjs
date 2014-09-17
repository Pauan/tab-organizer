@ = require([
  { id: "sjs:object" },
  { id: "lib:extension/client" },
  { id: "lib:util/dom" },
  { id: "../util" }
])

var close_button_style = @CSS(`
  width: 14px;
  height: 14px;
`)

exports.top = function () {
  return @options.category("Tabs", [
    @Div([
      "Sort tabs by... ",

      @options.list(@opt("group.sort.type") ..@extend({
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
    ]) ..@horizontal,

    @options.separator(),

    @Div([
      "Show the ",

      @Img(null, { src: "data/images/button-close.png", alt: "close" }) ..close_button_style,

      " button on the ",

      @options.list(@opt("tabs.close.location") ..@extend({
        items: [
          { name: "right", value: "right" },
          { name: "left",  value: "left"  }
        ]
      })),

      " side ",

      @options.list(@opt("tabs.close.display") ..@extend({
        items: [
          { name: "while hovering", value: "hover" },
          //o.item("of the focused tab", "focused") TODO
          { name: "of every tab",   value: "every" }
        ]
      }))
    ]) ..@horizontal,

    @options.separator(),

    @options.header("Click behavior:"),
    @options.indent([
      @options.radio(@opt("tabs.click.type") ..@extend({
        items: [
          { name: "1 click to focus",                     value: "focus"        },
          { name: "1 click to select, 2 clicks to focus", value: "select-focus" }
        ]
      }))
    ]),

    @options.separator(),

    @options.checkbox(@opt("tabs.close.duplicates") ..@extend({
      text: "Automatically close duplicate tabs"
    }))
  ])
}
