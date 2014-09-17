@ = require([
  { id: "sjs:object" },
  { id: "lib:extension/client" },
  { id: "lib:util/dom" },
  { id: "../util" }
])

exports.top = function () {
  return @options.category("Counter", [
    @Div([
      @options.checkbox(@opt("counter.enabled") ..@extend({
        text: "Display a counter that shows how many tabs you have"
      })),

      @options.horizontal_space("1px"),

      @options.list(@opt("counter.type") ..@extend({
        items: [
          { name: "in total",  value: "total"     },
          { name: "in Chrome", value: "in-chrome" }
        ]
      }))
    ]) ..@horizontal
  ])
}
