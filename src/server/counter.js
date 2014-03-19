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
    var type = opt.get("counter.type")

    cell.bind([type], function (type) {
      if (type === "in-chrome" || type === "total") {
        platform.button.setColor(0, 0, 0, 0.9)
      } else {
        fail()
      }
    })

    var tabCount = cell.bind([type], function (type) {
      if (type === "in-chrome") {
        return array.len(platform.tabs.getAll())
      } else if (type === "total") {
        return object.len(tabs.getAll())
      } else {
        fail()
      }
    })

    cell.event([tabs.on.created], function () {
      if (type.get() === "total") {
        tabCount.set(tabCount.get() + 1)
      }
    })

    cell.event([tabs.on.removed], function () {
      if (type.get() === "total") {
        tabCount.set(tabCount.get() - 1)
      }
    })

    cell.event([platform.tabs.on.created], function () {
      if (type.get() === "in-chrome") {
        tabCount.set(tabCount.get() + 1)
      }
    })

    cell.event([platform.tabs.on.removed], function () {
      if (type.get() === "in-chrome") {
        tabCount.set(tabCount.get() - 1)
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
