require("../../hubs")

@ = require([
  { id: "sjs:object" },
  { id: "lib:extension/client" },
  { id: "lib:util/dom", name: "dom" },
  { id: "../options" }
])

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

var preview_style = @dom.CSS(`
  border-width: 1px;
  border-radius: 5px;
  border-color: black;
  margin-top: 0.4em;
  margin-bottom: 7px;
  width: 100%;
  height: 200px;
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
  ])
]))

console.info("main: finished")
