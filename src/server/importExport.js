goog.provide("importExport")

goog.require("platform.port")
goog.require("platform.db")
goog.require("util.cell")
goog.require("util.log")

goog.scope(function () {
  var log  = util.log.log
    , cell = util.cell
    , db   = platform.db

  platform.port.onRequest("db.export", function (x, send) {
    cell.when(db.loaded, function () {
      send(db.getAll())
    })
    return true
  })

  platform.port.onRequest("db.import", function (x) {
    log("db.import", x)
  })
})
