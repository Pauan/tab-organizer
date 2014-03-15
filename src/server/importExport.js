goog.provide("importExport")

goog.require("platform.port")
goog.require("platform.db")
goog.require("util.cell")
goog.require("util.log")
goog.require("tabs")
goog.require("opt")
goog.require("cache")
goog.require("migrate")

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

  platform.port.onRequest("db.import", function (x, send) {
    cell.when(migrate.loaded, function () {
      cell.when(cell.and(tabs.fromDisk(x),
                         opt.fromDisk(x),
                         // TODO is this even necessary? I mean, should it load the cache when importing?
                         cache.fromDisk(x)), function () {
        migrate.migrate(x["version"])
        send(null)
      })
    })
    return true
  })
})
