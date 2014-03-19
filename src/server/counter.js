goog.provide("counter")

goog.require("platform.button")
goog.require("platform.tabs")
goog.require("util.cell")
goog.require("util.log")
goog.require("util.array")
goog.require("util.object")
goog.require("opt")
goog.require("tabs")

goog.scope(function () {
  var cell   = util.cell
    , array  = util.array
    , object = util.object
    , fail   = util.log.fail

  cell.when(cell.and(opt.loaded, tabs.loaded, platform.tabs.loaded), function () {
    cell.bind([opt.get("counter.type")], function (type) {
      if (type === "in-chrome" || type === "total") {
        platform.button.setColor(0, 0, 0, 0.9)
      } else {
        fail()
      }
    })

    var tabCount = cell.bind([opt.get("counter.type")], function (type) {
      if (type === "in-chrome") {
        return array.len(platform.tabs.getAll())
      } else if (type === "total") {
        return object.len(tabs.all.get())
      } else {
        fail()
      }
    })

    cell.bind([tabCount, opt.get("counter.enabled")], function (i, enabled) {
      if (enabled) {
        platform.button.setText(i)
      } else {
        platform.button.setText("")
      }
    })
  })
})
