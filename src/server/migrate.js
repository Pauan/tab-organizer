goog.provide("migrate")

goog.require("util.cell")
goog.require("util.array")
goog.require("util.object")
goog.require("util.log")
goog.require("platform.db")
goog.require("platform.manifest")
goog.require("serialize")

goog.scope(function () {
  var cell      = util.cell
    , array     = util.array
    , object    = util.object
    , db        = platform.db
    , manifest  = platform.manifest
    , log       = util.log.log
    , tabToDisk = serialize.tabToDisk

  var version = manifest.get("version") + "b5"

  migrate.loaded = cell.dedupe(false)

  migrate.migrate = function (oldVer) {
    log(oldVer, version)
    if (oldVer !== version) {
      db.del("current.groups")
      db.del("current.tabs.ids")

      db.open("current.tabs", function (d) {
        var o = d.getAll()
        array.each(object.keys(o), function (s) {
          var x = o[s]
          if (x["url"] != null && s !== x["url"]) {
            log(s, x["url"])
            d.set(x["url"], tabToDisk(x))
            d.del(s)
          } else {
            d.set(s, tabToDisk(x))
          }
        })
      })

      db.open("options.user", function (o) {
        o.del("tab.sort.type")
        o.del("tab.show.in-chrome")
        o.del("groups.move-with-window")
        o.moveValue("group.sort.type", "domain", "url")
        o.moveValue("group.sort.type", "loaded", "created")
        //o.moveValue("tab.sort.type",   "loaded", "created")
        o.move("size.sidebar.direction", "size.sidebar.position")
      })

      db.open("options.cache", function (o) {
        o.move("global.scroll", "popup.scroll")

        if (o.has("screen.available-size")) {
          var oSize = o.get("screen.available-size")
          o.set("screen.available.checked", true)
          o.set("screen.available.left", oSize["left"])
          o.set("screen.available.top", oSize["top"])
          o.set("screen.available.width", oSize["width"])
          o.set("screen.available.height", oSize["height"])
          o.del("screen.available-size")
        }
      })

      delete localStorage["migrated"]
    }
  }

  cell.when(db.loaded, function () {
    db.raw("version", function (dbVersion) {
      var oldVer = dbVersion.get()
      if (oldVer !== version) {
        migrate.migrate(oldVer)
        dbVersion.set(version)
      }
      log(db.getAll())
      migrate.loaded.set(true)
    })
  })
})
