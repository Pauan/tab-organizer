goog.provide("importExport")

goog.require("util.cell")
goog.require("platform.db")
goog.require("migrate")
goog.require("tabs")
goog.require("opt")
goog.require("cache")

goog.scope(function () {
  var cell = util.cell
    , db   = platform.db

  importExport.init = function () {
    cell.event(port.on.connect("db.export"), function (send) {
      db.getAll(function (o) {
        console.log(o)
        send(o)
      })
    })

    cell.event(port.on.oneshot("db.import"), function (value, send) {
      cell.when(migrate.loaded, function () {
        var loaded1 = tabs.fromDisk(value)
          , loaded2 = opt.fromDisk(value)
          // TODO is this even necessary? I mean, should it load the cache when importing?
          , loaded3 = cache.fromDisk(value)

        cell.when(cell.and(loaded1, loaded2, loaded3), function () {
          migrate.migrate(value["version"])
          send()
        })
      })
    })
  }
})