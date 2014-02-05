goog.provide("ui.search")

goog.require("util.dom")
goog.require("util.cell")
goog.require("search")

goog.scope(function () {
  var dom  = util.dom
    , cell = util.cell

  var searchStyle = dom.style(function (e) {
    e.styles(dom.stretch)
    e.set("padding", "1px 2px")
  })

  var errorStyle = dom.style(function (e) {
    e.set("background-color", dom.hsl(0, 100, 60, 0.5))
  })

  ui.search.make = function (e) {
    var value = cache.get("search.last")

    dom.search(function (e) {
      e.styles(searchStyle)
      e.autofocus(true)
      /*e.shadow(function (t) {
        t.inset(true)
        t.left("1px")
        t.top("1px")
        t.blur("3px")
        t.color(color.hsl(0, 0, 96))
      })*/
      /*e.outline(function (t) {
        t.style("auto")
        t.size("3px")
        t.color(color.hsl(211, 100, 65)) // TODO code duplication with "common-ui" module
      })*/

      e.bind([search.on], function (x) {
        if (x.value == null) {
          e.title(x.error)
          e.styleWhen(errorStyle, true)
        } else {
          e.title("")
          e.styleWhen(errorStyle, false)
        }
      })

      e.sync(value)
    }).move(e)
  }
})
