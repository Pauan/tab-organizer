@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" },
  { id: "sjs:object" },
  { id: "lib:util/util" },
  { id: "lib:util/event" },
  { id: "lib:extension/server" },
  { id: "./migrate", name: "migrate" }
])


//var url_popup = @url.get("panel.html")

//@migrate.db["delete"]("current.windows.array")

var tabs_id    = {}
var windows_id = {}

var windows_db = @migrate.db.get("current.windows.array", [])

function save() {
  @migrate.db.set("current.windows.array", windows_db)
}

// TODO this is specific to Chrome...?
// TODO test this again, to make sure it's working
function save_delay() {
  // 10 seconds, so that when Chrome exits,
  // it doesn't clobber the user's data
  return @migrate.db.delay("current.windows.array", 10000, function () {
    return save()
  })
}


// TODO library function for this ?
function setNull(obj, key, value) {
  if (value != null) {
    obj[key] = value
  } else {
    delete obj[key]
  }
}

// TODO library function for this ?
function setBoolean(obj, key, value) {
  // TODO use isBoolean test for this
  @assert.ok(value === true || value === false)
  if (value) {
    obj[key] = 1
  } else {
    delete obj[key]
  }
}

// TODO library function for this ?
function isBoolean(obj, key) {
  var value = obj[key]
  if (value === void 0) {
    return false
  } else if (value === 1) {
    return true
  } else {
    throw new Error("invalid value #{value}")
  }
}

function shouldUpdate(tab_old, tab_new) {
  @assert.is(tab_old.active ..isBoolean("focused"), tab_new.focused)

  return (tab_old.url     !== tab_new.url) ||
         (tab_old.favicon !== tab_new.favicon) ||
         (tab_old.title   !== tab_new.title) ||
         (tab_old ..isBoolean("pinned") !== tab_new.pinned)
}

function setTab(tab_old, tab_new) {
  @assert.is(tab_old.active ..isBoolean("focused"), tab_new.focused)

  tab_old ..setNull("url", tab_new.url)
  tab_old ..setNull("favicon", tab_new.favicon)
  tab_old ..setNull("title", tab_new.title)
  tab_old ..setBoolean("pinned", tab_new.pinned)
}

function resetFocus(tab_old, tab_new) {
  @assert.ok(tab_old.active == null)
  tab_old.active = {}
  tab_old.active ..setBoolean("focused", tab_new.focused)
}


function addWindow(window_new) {
  var created = @timestamp()

  var window = {
    id: window_new.id,
    time: {
      created: created
    },
    children: []
  }

  windows_id ..@setNew(window.id, window)
  windows_db ..@pushNew(window)

  window_new.tabs ..@each(function (tab_new) {
    addTab(tab_new)
  })

  save()

  @connection.send("tabs", {
    type: "window-created",
    window: window
  })

  return window
}

function removeWindow(window_new) {
  var window_old = windows_id ..@get(window_new.id)

  @assert.is(window_old.id, window_new.id)

  windows_id ..@delete(window_old.id)
  windows_db ..@remove(window_old)

  window_old.children ..@each(function (tab_old) {
    console.log("REMOVING UNLOADED CHILD #{tab_old.url}")
    tabs_id ..@delete(tab_old.id)
  })

  save_delay()

  @connection.send("tabs", {
    type: "window-removed",
    window: window_old
  })

  return window_old
}

function addTab(tab_new) {
  var created = @timestamp()

  var tab = {
    id: tab_new.id,
    time: {
      created: created
    }
  }

  resetFocus(tab, tab_new)
  setTab(tab, tab_new)
  tabs_id ..@setNew(tab.id, tab)

  // TODO assert that the window is correct somehow ?
  var window_old = windows_id ..@get(tab_new.window.id)

  var index = getIndexForTab(window_old, tab_new)
  window_old.children ..@spliceNew(index, tab)

  save()

  @connection.send("tabs", {
    type: "tab-created",
    tab: tab,
    move_to: {
      window: window_old.id,
      index: index
    }
  })

  return tab
}

function removeTab(tab_new, delay) {
  // TODO replace with isBoolean test
  @assert.ok(delay === true || delay === false)

  var tab_old = tabs_id ..@get(tab_new.id)
  var window_old = windows_id ..@get(tab_new.window.id)

  @assert.is(tab_old.id, tab_new.id)

  tabs_id ..@delete(tab_old.id)
  window_old.children ..@remove(tab_old)

  if (delay) {
    save_delay()
  } else {
    save()
  }

  @connection.send("tabs", {
    type: "tab-removed",
    tab: tab_old,
    move_from: {
      window: window_old.id
    }
  })

  return tab_old
}

function updateTab(tab_old, tab_new) {
  if (shouldUpdate(tab_old, tab_new)) {
    setTab(tab_old, tab_new)
    tab_old.time.updated = @timestamp()

    save()

    @connection.send("tabs", {
      type: "tab-updated",
      tab: tab_old
    })
  }
  return tab_old
}

function getIndexForTab(window_old, tab_new) {
  @assert.is(tab_new.window.tabs[tab_new.index], tab_new)

  if (tab_new.index === 0) {
    return 0
  } else {
    // Get the tab to the left
    var prev = tab_new.window.tabs ..@get(tab_new.index - 1)
    var prev_new = tabs_id ..@get(prev.id)
    return window_old.children ..@indexOf(prev_new) + 1
  }
}

// TODO it should probably take into account the direction of movement (left or right)
function moveTab(tab_new, info) {
  var tab_old = tabs_id ..@get(tab_new.id)
  // TODO assert that the window is correct somehow ?
  var window_old = windows_id ..@get(info.window.id)
  var window_new = windows_id ..@get(tab_new.window.id)

  window_old.children ..@remove(tab_old)

  var index = getIndexForTab(window_new, tab_new)
  window_new.children ..@spliceNew(index, tab_old)

  tab_old.time.moved = @timestamp()

  if (window_old === window_new) {
    tab_old.time.moved_in_window = tab_old.time.moved
  } else {
    tab_old.time.moved_to_window = tab_old.time.moved
  }

  save()

  @connection.send("tabs", {
    type: "tab-moved",
    tab: tab_old,
    move_from: {
      window: window_old.id
    },
    move_to: {
      window: window_new.id,
      index: index
    }
  })

  return tab_old
}

function focusTab(tab_new) {
  var tab_old = tabs_id ..@get(tab_new.id)

  @assert.is(tab_new.focused, true)
  @assert.ok(tab_old.active != null)
  @assert.is(tab_old.active ..isBoolean("focused"), false)

  tab_old.active ..setBoolean("focused", true)
  tab_old.time.focused = @timestamp()

  save()

  @connection.send("tabs", {
    type: "tab-focused",
    tab: tab_old
  })

  return tab_old
}

// This doesn't need to save, because the only thing that changed is its focused state, which is transient
function unfocusTab(tab_new) {
  var tab_old = tabs_id ..@get(tab_new.id)

  @assert.is(tab_new.focused, false)
  @assert.ok(tab_old.active != null)
  @assert.is(tab_old.active ..isBoolean("focused"), true)

  tab_old.active ..setBoolean("focused", false)
  tab_old.time.unfocused = @timestamp()

  save()

  @connection.send("tabs", {
    type: "tab-unfocused",
    tab: tab_old
  })

  return tab_old
}


// Load in saved tabs
windows_db ..@each(function (window_old) {
  windows_id ..@setNew(window_old.id, window_old)

  window_old.children ..@each(function (tab_old) {
    delete tab_old.active
    tabs_id ..@setNew(tab_old.id, tab_old)
  })
})

// Load in new tabs
@windows.getCurrent() ..@each(function (window_new) {
  if (windows_id ..@has(window_new.id)) {
    window_new.tabs ..@each(function (tab_new) {
      if (tabs_id ..@has(tab_new.id)) {
        var tab_old = tabs_id ..@get(tab_new.id)

        resetFocus(tab_old, tab_new)

        // TODO check that the relative position of the tab is correct?
        updateTab(tab_old, tab_new)
      } else {
        addTab(tab_new)
      }
    })
  } else {
    addWindow(window_new)
  }
})

// Migrate old window titles to the new system
// TODO hacky that this is in here, rather than in migrate.sjs
if (@migrate.db.has("window.titles")) {
  @zip(@windows.getCurrent(), @migrate.db.get("window.titles")) ..@each(function ([window, title]) {
    var window_new = windows_id ..@get(window.id)
    window_new.name = title
    save()
  })

  // TODO
  @migrate.db["delete"]("window.titles")
}

// This probably isn't necessary, but I like it just in case
save()

console.info("tabs: saved windows", windows_db)


exports.windows = {}

exports.windows.getCurrent = function () {
  return windows_db
}

exports.tabs = {}
exports.tabs.on = {}
exports.tabs.on.open = @Emitter()
exports.tabs.on.close = @Emitter()

spawn @windows.on.open ..@each(function (info) {
  console.debug("ADD WINDOW", info)
  addWindow(info.window)
})

spawn @windows.on.close ..@each(function (info) {
  console.debug("REMOVE WINDOW", info)
  removeWindow(info.window)
})

spawn @tabs.on.open ..@each(function (info) {
  console.debug("ADD", info)
  exports.tabs.on.open ..@emit({
    tab: addTab(info.tab)
  })
})

spawn @tabs.on.close ..@each(function (info) {
  console.debug("REMOVE", info)
  exports.tabs.on.close ..@emit({
    tab: removeTab(info.tab, info.windowClosing)
  })
})

spawn @tabs.on.update ..@each(function (info) {
  console.debug("UPDATE", info)
  var tab_new = info.tab
  var tab_old = tabs_id ..@get(tab_new.id)
  updateTab(tab_old, tab_new)
})

spawn @tabs.on.focus ..@each(function (info) {
  console.debug("FOCUS", info)
  focusTab(info.tab)
})

spawn @tabs.on.unfocus ..@each(function (info) {
  console.debug("UNFOCUS", info)
  unfocusTab(info.tab)
})

spawn @tabs.on.move ..@each(function (info) {
  console.debug("MOVE", info)
  moveTab(info.tab, info.old)
})


@connection.on.connect("tabs", function () {
  return {
    windows: windows_db
  }
})


console.info("tabs: finished")
