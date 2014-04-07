goog.provide("undo")

goog.require("util.cell")
goog.require("util.array")
goog.require("util.log")
goog.require("platform.db")
goog.require("platform.port")

// TODO undo should be imported from JSON backups
goog.scope(function () {
  var cell  = util.cell
    , array = util.array
    , log   = util.log.log
    , fail  = util.log.fail
    , db    = platform.db

  undo.loaded = cell.dedupe(false)

  cell.when(db.loaded, function () {
    var aUndo = db.raw("undo")
    aUndo.setNew([])

    cell.event([platform.port.on.connect("undo")], function (port) {
      log("UNDO", aUndo.get())
      port.message(aUndo.get())
    })

    cell.event([platform.port.on.message("undo")], function (a) {
      array.each(a, function (o) {
        var type  = o["type"]
          , value = o["value"]
        if (type === "create") {
          // TODO it needs to remove old entries when the array reaches a certain size
          var a = aUndo.get()
          array.push(a, value)
          aUndo.set(a)
        } else {
          fail()
        }
      })
    })

    undo.loaded.set(true)
  })
})
