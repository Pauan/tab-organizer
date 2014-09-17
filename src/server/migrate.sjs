@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:object" },
  { id: "sjs:sequence" },
  { id: "lib:util/util" },
  { id: "lib:extension/server" }
])


// TODO make this const ?
exports.version = @manifest ..@get("version") + "b8"


function isNewVersion() {
  var version_old = @db.get("version", undefined)
  return version_old !== exports.version
}

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
  o.groups = tab.groups
  o.title  = tab.title

  set(o, tab, "created")
  set(o, tab, "updated")
  set(o, tab, "focused")
  set(o, tab, "unloaded")
  set(o, tab, "session")
  return o
}


var migrators = {}

function set_migrator(name, f) {
  migrators[name] = function () {
    //if (isNewVersion()) {
    f()
    console.info("migrate/run: finished #{name}")
    //migrators[name] = function () {}
    //}
  }
}

function make_setter(name, f) {
  set_migrator(name, function () {
    if (@db.has(name)) {
      var o = @db.get(name)
      f(o)
      @db.set(name, o)
    }
  })
}

function make_deleter(name, f) {
  set_migrator(name, function () {
    if (@db.has(name)) {
      var o = @db.get(name)
      f(o)
      // TODO
      @db["delete"](name)
    }
  })
}


make_deleter("current.tabs", function (tabs) {
  var windows_db = @db.get("current.windows.array", [])

  var groups = {}

  function addToGroup(name, time, tab, url) {
    if (time === 1 || time === null) {
      time = @timestamp()
    }

    var group = groups ..@get_or_set(name, function () {
      var o = {
        id: @timestamp(),
        time: {
          created: time
        },
        children: []
      }

      if (name !== "") {
        o.name = name
      }

      windows_db.push(o)
      return o
    })

    group.time.created = Math.min(group.time.created, time)

    group.children.push({
      id: @timestamp(),
      url: url,
      favicon: "chrome://favicon/#{url}", // TODO hacky and code duplication with lib:extension
      time: tab.time,
      title: tab.title
    })

    @db.set("current.windows.array", windows_db)
  }


  tabs ..@eachKeys(function (url, tab) {
    if (tab.url != null && url !== tab.url) {
      url = tab.url
    }

    tab = convertTab(tab)

    var seen = false

    tab.groups ..@eachKeys(function (key, value) {
      seen = true

      addToGroup(key, value, tab, url)
    })

    if (!seen) {
      addToGroup("", null, tab, url)
    }
  })
})


make_setter("options.user", function (opts) {
  // TODO utility for these ?
  delete opts["tab.sort.type"]
  delete opts["tab.show.in-chrome"]
  delete opts["groups.move-with-window"]

  delete opts["popup.hotkey.ctrl"]
  delete opts["popup.hotkey.shift"]
  delete opts["popup.hotkey.alt"]
  delete opts["popup.hotkey.letter"]

  opts ..moveValue("group.sort.type", "window", "group")
  opts ..moveValue("group.sort.type", "domain", "url")
  opts ..moveValue("group.sort.type", "loaded", "created")
  //opts ..moveValue("tab.sort.type",   "loaded", "created")
  opts ..move("size.sidebar.direction", "size.sidebar.position")
})


make_setter("options.cache", function (cache) {
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
})


exports.run = function (name) {
  return (migrators ..@get(name))()
}

exports.db = @db

exports.migrate = function () {
  //@db["delete"]("version")

  if (isNewVersion()) {
    exports.run("current.tabs")
    exports.run("options.user")
    exports.run("options.cache")

    // TODO fix these
    @db["delete"]("current.groups")
    @db["delete"]("current.tabs.ids")
    delete localStorage["migrated"]

    @db.set("version", exports.version)
    console.info("migrate: migrated to version #{exports.version}")
  }

  console.info("migrate: finished")
}

exports.migrate()


// TODO it's hacky that this is here
@connection.on.command("db.export", function () {
  return @db.getAll()
})
