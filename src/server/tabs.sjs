@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" },
  { id: "sjs:object" },
  { id: "lib:util/util" },
  { id: "lib:util/event" },
  { id: "lib:extension/server" },
  { id: "./migrate", name: "migrate" },
  { id: "./session", name: "session" }
])


//var url_popup = @url.get("popup.html")

//@migrate.db["delete"]("current.windows.array")

var tabs_id    = {}
var windows_id = {}

var windows_db = @migrate.db.get("current.windows.array", [])

// TODO code duplication with session
function save() {
  @migrate.db.set("current.windows.array", windows_db)
}

// TODO this is specific to Chrome...?
// TODO test this again, to make sure it's working
// TODO code duplication with session
function save_delay() {
  // 10 seconds, so that when Chrome exits,
  // it doesn't clobber the user's data
  return @migrate.db.delay("current.windows.array", 10000, function () {
    return save()
  })
}


function id_from_window(window) {
  return @session.windows.get(window.id).id
}

function id_from_tab(tab) {
  return @session.tabs.get(tab.id).id
}

function window_from_chrome(window_new) {
  var id = id_from_window(window_new)
  var window_old = windows_id ..@get(id)
  @assert.is(window_old.id, id)
  return window_old
}

function tab_from_chrome(tab_new) {
  var id = id_from_tab(tab_new)
  var tab_old = tabs_id ..@get(id)
  @assert.is(tab_old.id, id)
  return tab_old
}


// TODO library function for this ?
function set_null(obj, key, value) {
  if (value != null) {
    obj[key] = value
  } else {
    delete obj[key]
  }
}

// TODO library function for this ?
function set_boolean(obj, key, value) {
  // TODO use isBoolean test for this
  @assert.ok(value === true || value === false)
  if (value) {
    obj[key] = 1
  } else {
    delete obj[key]
  }
}

// TODO library function for this ?
function to_boolean(obj, key) {
  var value = obj[key]
  if (value === void 0) {
    return false
  } else if (value === 1) {
    return true
  } else {
    throw new Error("invalid value #{value}")
  }
}

function should_update(tab_old, tab_new) {
  @assert.is(tab_old.active ..to_boolean("focused"), tab_new.focused)

  return (tab_old.url     !== tab_new.url) ||
         (tab_old.favicon !== tab_new.favicon) ||
         (tab_old.title   !== tab_new.title) ||
         (tab_old ..to_boolean("pinned") !== tab_new.pinned)
}

function tab_set(tab_old, tab_new) {
  @assert.is(tab_old.active ..to_boolean("focused"), tab_new.focused)

  tab_old ..set_null("url", tab_new.url)
  tab_old ..set_null("favicon", tab_new.favicon)
  tab_old ..set_null("title", tab_new.title)
  tab_old ..set_boolean("pinned", tab_new.pinned)
}

function tab_reset_focus(tab_old, tab_new) {
  @assert.ok(tab_old.active == null)
  tab_old.active = {}
  tab_old.active ..set_boolean("focused", tab_new.focused)
}


function window_open(id, window_new) {
  var created = @timestamp()

  var window = {
    id: id,
    time: {
      created: created
    },
    children: []
  }

  windows_id ..@setNew(window.id, window)
  windows_db ..@pushNew(window)

  // TODO is this correct ?
  window_new.tabs ..@each(function (tab_new) {
    tab_open(id_from_tab(tab_new), window_new, tab_new)
  })

  save()

  @connection.send("tabs", {
    type: "window-created",
    window: window
  })

  return window
}

function window_close(window_old) {
  windows_id ..@delete(window_old.id)
  windows_db ..@remove(window_old)

  // TODO is this necessary ?
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

function tab_open(id, window_new, tab_new) {
  var window_old = window_from_chrome(window_new)

  var created = @timestamp()

  var tab = {
    id: id,
    time: {
      created: created
    }
  }

  tab_reset_focus(tab, tab_new)
  tab_set(tab, tab_new)
  tabs_id ..@setNew(tab.id, tab)

  var index = index_from_tab(window_old, window_new, tab_new)
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

function tab_close(tab_old, window_old, closing) {
  // TODO replace with isBoolean test
  @assert.ok(closing === true || closing === false)

  tabs_id ..@delete(tab_old.id)
  window_old.children ..@remove(tab_old)

  if (closing) {
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

function tab_update(tab_old, tab_new) {
  if (should_update(tab_old, tab_new)) {
    tab_set(tab_old, tab_new)
    tab_old.time.updated = @timestamp()

    save()

    @connection.send("tabs", {
      type: "tab-updated",
      tab: tab_old
    })
  }
  return tab_old
}

function index_from_tab(window_old, window_new, tab_new) {
  if (tab_new.index === 0) {
    return 0
  } else {
    // Get the tab to the left
    var tabs = @session.windows.get(window_new.id).tabs
    var prev = tabs ..@get(tab_new.index - 1)
    var prev_old = tabs_id ..@get(prev.id)
    return (window_old.children ..@indexOf(prev_old)) + 1
  }
}

// TODO it should probably take into account the direction of movement (left or right)
function tab_move(event) {
  @assert.ok(event.before.window || event.after.window)
  @assert.is(event.before.tab.id, event.after.tab.id)

  var tab_old = tab_from_chrome(event.after.tab)

  if (event.before.window) {
    var window_before = window_from_chrome(event.before.window)
    window_before.children ..@remove(tab_old)
  }

  if (event.after.window) {
    var window_after = window_from_chrome(event.after.window)
    var index        = index_from_tab(window_after, event.after.window, event.after.tab)
    window_after.children ..@spliceNew(index, tab_old)
  }

  if (event.after.window) {
    tab_old.time.moved = @timestamp()

    if (event.before.window && event.before.window.id === event.after.window.id) {
      tab_old.time.moved_in_window = tab_old.time.moved
    } else {
      tab_old.time.moved_to_window = tab_old.time.moved
    }
  }

  save()

  /*@connection.send("tabs", {
    type: "tab-moved",
    tab: tab_old,
    move_from: {
      window: window_old.id
    },
    move_to: {
      window: window_new.id,
      index: index
    }
  })*/

  return tab_old
}

function tab_focus(tab_old) {
  @assert.ok(tab_old.active != null)
  @assert.is(tab_old.active ..to_boolean("focused"), false)

  tab_old.active ..set_boolean("focused", true)
  tab_old.time.focused = @timestamp()

  save()

  @connection.send("tabs", {
    type: "tab-focused",
    tab: tab_old
  })

  return tab_old
}

function tab_unfocus(tab_old) {
  @assert.ok(tab_old.active != null)
  @assert.is(tab_old.active ..to_boolean("focused"), true)

  tab_old.active ..set_boolean("focused", false)
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
  var id = id_from_window(window_new)

  if (windows_id ..@has(id)) {
    window_new.tabs ..@each(function (tab_new) {
      var id = id_from_tab(tab_new)

      if (tabs_id ..@has(id)) {
        var tab_old = tabs_id ..@get(id)

        tab_reset_focus(tab_old, tab_new)

        // TODO check that the relative position of the tab is correct?
        tab_update(tab_old, tab_new)

      } else {
        tab_open(id, window_new, tab_new)
      }
    })

  } else {
    window_open(id, window_new)
  }
})

// Migrate old window titles to the new system
// TODO hacky that this is in here, rather than in migrate.sjs
// TODO test this
if (@migrate.db.has("window.titles")) {
  @zip(@windows.getCurrent(), @migrate.db.get("window.titles")) ..@each(function ([window, title]) {
    var window_new = window_from_chrome(window)
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
exports.tabs.events = @Emitter()

spawn @session.tabs.events ..@each(function (event) {
  if (event.type === "windows.open") {
    console.log(event.type)
    var id = id_from_window(event.after.window)
    window_open(id, event.after.window)

  } else if (event.type === "windows.close") {
    console.log(event.type)
    window_close(window_from_chrome(event.before.window))

  } else if (event.type === "tabs.open") {
    console.log(event.type)

    var id = id_from_tab(event.after.tab)

    exports.tabs.events ..@emit({
      type: "tabs.open",
      tab: tab_open(id, event.after.window, event.after.tab)
    })

  } else if (event.type === "tabs.update") {
    console.log(event.type)

    var tab_new = event.after.tab
    var tab_old = tab_from_chrome(tab_new)
    tab_update(tab_old, tab_new)

  //} else if (event.type === "tabs.replace") {
  //  console.log(event.type)
  } else if (event.type === "tabs.focus") {
    console.log(event.type)

    if (event.before) {
      tab_unfocus(tab_from_chrome(event.before.tab))
    }
    if (event.after) {
      tab_focus(tab_from_chrome(event.after.tab))
    }

  } else if (event.type === "tabs.move") {
    console.log(event.type)
    tab_move(event)

  } else if (event.type === "tabs.close") {
    console.log(event.type)

    var tab = tab_from_chrome(event.before.tab)
    var window = window_from_chrome(event.before.window)
    var closing = event.before.window.closing

    exports.tabs.events ..@emit({
      type: "tabs.close",
      tab: tab_close(tab, window, closing)
    })
  }
})


@connection.on.connect("tabs", function () {
  return {
    windows: windows_db
  }
})


console.info("tabs: finished")
