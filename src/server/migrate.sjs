@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:object" },
  { id: "./extension/main" },
  { id: "./util/util" }
])

var version = @manifest ..@get("version") + "b7"


// TODO utility for this ?
function moveValue(obj, key, from, to) {
  if (obj ..@has(key)) {
    if (obj ..@get(key) === from) {
      obj ..@set(key, to)
    }
  }
}

// TODO utility for this
function move(obj, from, to) {
  if (obj ..@has(from)) {
    var value = obj ..@get(from)
    obj ..@setNew(to, value)
    obj ..@delete(from)
  }
}


function set(o, tab, s) {
  if (tab.time[s] != null) {
    o.time[s] = tab.time[s]
  }
}

function convertTab(tab) {
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
}


function migrate(version_old) {
  if (version_old !== version) {
    /**
     * options.tabs
     */
    ;(function () {
      var tabs = @db.get("current.tabs", {})

      tabs ..@eachKeys(function (url, tab) {
        if (tab.url != null && url !== tab.url) {
          // TODO utility for these ?
          tabs[tab.url] = convertTab(tab)
          delete tabs[url]
        } else {
          // TODO utility for this ?
          tabs[url] = convertTab(tab)
        }
      })

      @db.set("current.tabs", tabs)
    })()


    /**
     * options.user
     */
    ;(function () {
      var opts = @db.get("options.user", {})

      // TODO utility for these ?
      delete opts["tab.sort.type"]
      delete opts["tab.show.in-chrome"]
      delete opts["groups.move-with-window"]
      opts ..moveValue("group.sort.type", "window", "group")
      opts ..moveValue("group.sort.type", "domain", "url")
      opts ..moveValue("group.sort.type", "loaded", "created")
      //opts ..moveValue("tab.sort.type",   "loaded", "created")
      opts ..move("size.sidebar.direction", "size.sidebar.position")

      @db.set("options.user", opts)
    })()


    /**
     * options.cache
     */
    ;(function () {
      var cache = @db.get("options.cache", {})

      cache ..move("global.scroll", "popup.scroll")

      if (cache ..@has("screen.available-size")) {
        var oSize = cache ..@get("screen.available-size")

        // TODO utility for these ?
        cache["screen.available.checked"] = true
        cache["screen.available.left"] = oSize ..@get("left")
        cache["screen.available.top"] = oSize ..@get("top")
        cache["screen.available.width"] = oSize ..@get("width")
        cache["screen.available.height"] = oSize ..@get("height")

        cache ..@delete("screen.available-size")
      }

      @db.set("options.cache", cache)
    })()


    /**
     * Other
     */
    // TODO fix these
    @db["delete"]("current.groups")
    @db["delete"]("current.tabs.ids")
    delete localStorage["migrated"]
  }
}

exports.init = function () {
  //@db["delete"]("version")

  var version_old = @db.get("version", undefined)

  if (version_old !== version) {
    @db.wait(function () {
      migrate(version_old)
      @db.set("version", version)
    })

    console.info("migrate: migrated to version #{version}")
  }

  console.info("migrate: finished")
}
