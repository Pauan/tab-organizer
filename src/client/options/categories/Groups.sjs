@ = require([
  { id: "sjs:object" },
  { id: "lib:extension/client" },
  { id: "../util" }
])

exports.top = function () {
  return @options.category("GROUPS", [
    @options.header("Display groups:"),
    @options.indent([
      @options.radio(@opt("groups.layout") ..@extend({
        items: [
          { name: "Vertically",   value: "vertical"   },
          { name: "Horizontally", value: "horizontal" },
          { name: "In a grid",    value: "grid"       }
        ]
      })),

      @options.vertical_space("2px"),

      @options.indent([
        @options.horizontal([
          @options.textbox(@opt("groups.layout.grid.column") ..@extend({
            width: "2em",
            type: "number",
            set: @toNum
          })),

          "columns"
        ]),

        @options.horizontal([
          @options.textbox(@opt("groups.layout.grid.row") ..@extend({
            width: "2em",
            type: "number",
            set: @toNum
          })),

          "rows"
        ])
      ])
    ])
  ])
}
