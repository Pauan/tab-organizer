@ = require([
  { id: "sjs:object" },
  { id: "lib:extension/client" },
  { id: "lib:util/dom" },
  { id: "../util" }
])

var preview_style = @CSS(`
  border: 1px solid black;
  border-radius: 5px;
  margin-top: 0.4em;
  margin-bottom: 7px;
  width: 100%;
  height: 200px;
`)

exports.top = function () {
  return @options.category("THEME", [
    @options.checkbox(@opt("theme.animation") ..@extend({
      text: "Animation enabled"
    })),

    @options.separator(),

    @options.horizontal([
      "Color... ",

      @options.list(@opt("theme.color") ..@extend({
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
    ]),

    @Iframe(null, { src: "panel.html" }) ..preview_style
  ])
}
