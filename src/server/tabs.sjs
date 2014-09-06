@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" },
  { id: "sjs:object" },
  { id: "./util/util" },
  { id: "./util/event" },
  { id: "./extension/main" }
])

exports.init = function () {
  var url_popup = @url.get("panel.html")
    , url_empty = @url.get("data/empty.html")

  //@db["delete"]("current.windows.array")

  var windows_db = @db.get("current.windows.array", [])

  function save() {
    @db.set("current.windows.array", windows_db)
  }

  // TODO this is specific to Chrome...?
  function save_delay() {
    // 10 seconds, so that when Chrome exits,
    // it doesn't clobber the user's data
    return @db.delay("current.windows.array", 10000, function () {
      return save()
    })
  }


  var tabs_id    = {}
  var windows_id = {}


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

  function setTab(tab_old, tab_new) {
    @assert.ok(tab_old.active != null)

    tab_old ..setNull("url", tab_new.url)
    tab_old ..setNull("favicon", tab_new.favicon)
    tab_old ..setNull("title", tab_new.title)
    tab_old ..setBoolean("pinned", tab_new.pinned)
    tab_old.active ..setBoolean("focused", tab_new.focused)
  }


  function addWindow(window_new) {
    var created = @timestamp()

    var window = {
      id: window_new.id,
      time: {
        created: created
      }
    }

    windows_id ..@setNew(window.id, window)
    windows_db ..@pushNew(window)

    window.children = []

    window_new.tabs ..@each(function (tab_new) {
      addTab(tab_new)
    })

    save()
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
    return window_old
  }

  function addTab(tab_new) {
    var created = @timestamp()

    var tab = {
      id: tab_new.id,
      time: {
        created: created
      },
      active: {}
    }

    setTab(tab, tab_new)
    tabs_id ..@setNew(tab.id, tab)

    // TODO assert that the window is correct somehow ?
    var window_old = windows_id ..@get(tab_new.window.id)

    var index = getIndexForTab(window_old, tab_new)
    window_old.children ..@spliceNew(index, tab)

    save()
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
    return tab_old
  }

  function updateTab(tab_old, tab_new) {
    @assert.is(tab_old.active ..isBoolean("focused"), tab_new.focused)

    setTab(tab_old, tab_new)
    tab_old.time.updated = @timestamp()

    save()
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

    save()
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
    return tab_old
  }

  // This doesn't need to save, because the only thing that changed is its focused state, which is transient
  function unfocusTab(tab_new) {
    var tab_old = tabs_id ..@get(tab_new.id)

    @assert.is(tab_new.focused, false)
    @assert.ok(tab_old.active != null)
    @assert.is(tab_old.active ..isBoolean("focused"), true)

    tab_old.active ..setBoolean("focused", false)

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

          @assert.ok(tab_old.active == null)
          // TODO is this a good idea?
          tab_old.active = {}
          tab_old.active ..setBoolean("focused", tab_new.focused)

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

  // TODO this probably isn't necessary, but I like it just in case
  save()


  @windows.on.add ..@listen(function (info) {
    console.debug("ADD WINDOW", info)
    addWindow(info.window)
  })

  @windows.on.remove ..@listen(function (info) {
    console.debug("REMOVE WINDOW", info)
    removeWindow(info.window)
  })

  @tabs.on.add ..@listen(function (info) {
    console.debug("ADD", info)
    addTab(info.tab)
  })

  @tabs.on.remove ..@listen(function (info) {
    console.debug("REMOVE", info)
    removeTab(info.tab, info.isWindowClosing)
  })

  @tabs.on.update ..@listen(function (info) {
    console.debug("UPDATE", info)
    var tab_new = info.tab
    var tab_old = tabs_id ..@get(tab_new.id)
    updateTab(tab_old, tab_new)
  })

  @tabs.on.focus ..@listen(function (info) {
    console.debug("FOCUS", info)
    focusTab(info.tab)
  })

  @tabs.on.unfocus ..@listen(function (info) {
    console.debug("UNFOCUS", info)
    unfocusTab(info.tab)
  })

  @tabs.on.move ..@listen(function (info) {
    console.debug("MOVE", info)
    moveTab(info.tab, info.old)
  })

  console.info("tabs: finished")
}
