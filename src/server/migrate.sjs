@ = require([
  { id: "sjs:object" },
  { id: "./extension/main" }
  //{ id: }
])

var version = @manifest ..@get("version") + "b7"


/*function set(o, tab, s) {
  if (tab.time[s] != null) {
    o.time[s] = tab.time[s]
  }
}

function diskToDisk(tab) {
  @assert.ok(tab.groups != null, tab.title)

  var o    = {}
  o.time   = {}
  o.groups = tab.groups // TODO migrate the old groups which only used 1 to indicate the group existed, migrate them to use the new system which uses timestamps
  o.title  = tab.title

  set(o, tab, "created")
  set(o, tab, "updated")
  set(o, tab, "focused")
  set(o, tab, "unloaded")
  set(o, tab, "session")
  return o
}*/

function migrate(version_old) {

}

exports.init = function () {
  var version_old = @db.get("version")

  console.log(version_old)

  //if (version_old !== version) {
    @db.wait(function () {
      migrate(version_old)
      @db.set("version", version)
    })
  //}

  console.info("migrate: finished")
}

/*migrate.migrate = function (oldVer) {
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
          d.set(x["url"], diskToDisk(x))
          d.del(s)
        } else {
          d.set(s, diskToDisk(x))
        }
      })
    })

    db.open("options.user", function (o) {
      o.del("tab.sort.type")
      o.del("tab.show.in-chrome")
      o.del("groups.move-with-window")
      o.moveValue("group.sort.type", "window", "group")
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
}*/
