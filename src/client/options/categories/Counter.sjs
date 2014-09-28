@ = require([
  { id: "sjs:object" },
  { id: "lib:extension/client" },
  { id: "../util" }
])

exports.top = function () {
  return @options.category("COUNTER", [
    @options.checkbox(@opt("counter.enabled") ..@extend({
      text: "Display a counter that shows how many tabs you have..."
    })),
    @options.indent([
      @options.checkbox(@opt("counter.display.loaded") ..@extend({
        text: "Loaded in Chrome"
      })),
      @options.checkbox(@opt("counter.display.unloaded") ..@extend({
        text: "Unloaded in Chrome"
      }))
    ])
  ])
}
