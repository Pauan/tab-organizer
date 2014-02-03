goog.provide("tab.windows")

goog.require("util.cell")
goog.require("util.time")
goog.require("platform.db")
goog.require("platform.tabs")
goog.require("goog.array")

goog.scope(function () {
  var cell  = util.cell
    , time  = util.time
    , tabs  = platform.tabs
    , array = goog.array
    , db    = platform.db

  tab.windows.getAll = function (f) {
    db.raw(["window.titles"], function (aNames) {
      aNames.setNew([])

      var aTime = [] // [Chrome Window Timestamps]

      function getName(timestamp) {
        var index = aTime.indexOf(timestamp)
        console.assert(index !== -1)
        return aNames.get()[index] || "" + (index + 1)
      }

      function setName(win) {
        win.timestamp = time.timestamp()
        aTime.push(win.timestamp)
        win.name = getName(win.timestamp)
      }

      tabs.getAll(function (a) {
        array.forEach(a, setName)

        cell.event([tabs.on.windowCreated], setName)

        cell.event([tabs.on.windowRemoved], function (win) {
          var i = aTime.indexOf(win.timestamp)
          if (i !== -1) {
            aTime.splice(i, 1)
          }
        })

        f(a)
      })
    })
  }
})