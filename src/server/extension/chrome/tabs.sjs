@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" },
  { id: "sjs:object" },
  { id: "../../util/util" },
  { id: "../../util/event" },
  { id: "./util" },
  { id: "./url", name: "url" },
  { id: "./db", name: "db" }
])


var windows_saved = @db.get("__extension.chrome.tabs.windows__", [])

function save() {
  @db.set("__extension.chrome.tabs.windows__", windows_saved)
}

function tabMatchesOld(tab_old, tab_new) {
  return tab_old.url === tab_new.url
}

function windowMatchesOld(window_old, window_new) {
  var tabs_old = window_old.tabs
  var tabs_new = window_new.tabs

  @assert.ok(tabs_old.length > 0)

  // Oddly enough, Chrome windows sometimes don't have a tabs property
  if (tabs_new != null) {
    @assert.ok(tabs_new.length > 0)

    // Check that all the old tabs match with the new tabs
    return @zip(tabs_old, tabs_new) ..@all(function ([tab_old, tab_new]) {
      return tabMatchesOld(tab_old, tab_new)
    })
  } else {
    return false
  }
}

function mergeWindow(window_old, window_new) {
  var window = addWindowWithId(window_old.id, window_new)

  // TODO code duplication
  var tabs_old = window_old.tabs
  var tabs_new = window_new.tabs

  @assert.ok(tabs_old.length > 0)

  // Oddly enough, Chrome windows sometimes don't have a tabs property
  if (tabs_new != null) {
    @assert.ok(tabs_new.length > 0)

    tabs_new ..@indexed ..@each(function ([i, tab_new]) {
      // Merge with existing tab
      if (i < tabs_old.length) {
        var tab_old = tabs_old[i]
        addTabWithId(tab_old.id, tab_new)

      // Add new tab
      } else {
        addTab(tab_new)
      }
    })
  }

  return window
}

function mergeAllWindows(array_new) {
  var array_old = windows_saved
  windows_saved = []

  // TODO maybe instead change it so db automatically merges concurrent changes into a single change?
  @db.disable("__extension.chrome.tabs.windows__", function () {
    // TODO replace with iterator or something
    var i = 0

    // Merge new windows into old windows
    array_old ..@each { |window_old|
      if (i < array_new.length) {
        var window_new = array_new[i]

        // New window matches the old window
        if (windowMatchesOld(window_old, window_new)) {
          mergeWindow(window_old, window_new)
          console.info("extension.chrome.tabs: merged #{window_new.tabs.length} tabs into window #{window_old.id}")
          ++i
        }
      } else {
        break
      }
    }

    // New windows
    while (i < array_new.length) {
      var window_new = array_new[i]
      var window = addWindow(window_new)
      console.info("extension.chrome.tabs: created new window #{window.id} with #{window.tabs.length} tabs")
      ++i
    }
  })

  save()
}


var windows    = []
var windows_id = {}
var tabs_id    = {}


exports.windows = {}
exports.windows.on = {}
exports.windows.on.add = @Emitter()
exports.windows.on.remove = @Emitter()

exports.tabs = {}
exports.tabs.on = {}
exports.tabs.on.add = @Emitter()
exports.tabs.on.update = @Emitter()
exports.tabs.on.remove = @Emitter()
exports.tabs.on.focus = @Emitter()
exports.tabs.on.unfocus = @Emitter()
exports.tabs.on.move = @Emitter()


/**
 * Verifies that the tab's focus state is correct
 */
function checkFocus(tab) {
  if (tab.window != null) {
    if (tab.focused) {
      @assert.is(tab.window.focusedTab, tab)
    } else {
      @assert.isNot(tab.window.focusedTab, tab)
    }
  }
}

/**
 * Verifies that the tab's state is correct (compared to a Chrome tab)
 */
function checkTab(tab, info) {
  @assert.ok(tabs_id ..@has(info.id))
  @assert.ok(tabs_id ..@has(tab.__id__))
  @assert.is(tab.closed, false)
  @assert.ok(info.index != null)
  @assert.ok(tab.window != null)
  @assert.is(tab.window.__id__, info.windowId)
  @assert.is(tab.window.tabs[info.index], tab)
  @assert.is(tab.window.__saved__.tabs[info.index], tab.__saved__)

  @assert.is(tab.__id__, info.id)
  @assert.isNot(tab.id, info.id) // TODO should probably remove this
  @assert.is(tab.window.__id__, info.windowId)
  @assert.is(tab.focused, info.active)
  @assert.is(tab.index, info.index)

  checkFocus(tab)
}

function updateIndexes(array, index) {
  var result = []
  while (index < array.length) {
    var x = array[index]
    if (x.index !== index) {
      x.index = index
      result.push(x)
    }
    ++index
  }
  return result
}

// TODO normalize URL?
function setTab(tab, info) {
  if (info.url === void 0) {
    delete tab.__saved__.url
  } else {
    tab.__saved__.url = info.url
  }

  tab.url = info.url
  tab.favicon = "chrome://favicon/" + info.url
  tab.title = info.title
  tab.pinned = info.pinned

  save()
}

function shouldUpdate(tab, info) {
  return tab.url !== info.url ||
         tab.title !== info.title ||
         tab.pinned !== info.pinned
}

function updateTab(tab, info) {
  checkTab(tab, info)

  if (shouldUpdate(tab, info)) {
    setTab(tab, info)

    exports.tabs.on.update ..@emit({
      tab: tab
    })
  }
}

function unfocusTab(tab) {
  @assert.is(tab.focused, true)
  tab.focused = false

  checkFocus(tab)

  exports.tabs.on.unfocus ..@emit({
    tab: tab
  })
}

function focusTab(tab) {
  var old = tab.window.focusedTab
  tab.window.focusedTab = tab

  // This happens when...
  // A) the tab already exists and is already focused (e.g. on startup)
  // B) the tab is moved to/from a different window
  if (tab.focused) {
    checkFocus(tab)

  // This happens when...
  // A) the tab is created and it's not focused yet (e.g. when opening a new tab)
  // B) the tab is unfocused and then becomes focused (e.g. by clicking on it)
  } else {
    tab.focused = true

    checkFocus(tab)

    exports.tabs.on.focus ..@emit({
      tab: tab
    })
  }

  // There won't be an old focused tab when the window was just created
  // (e.g. when the tab is being moved to a different window)
  if (old != null) {
    @assert.isNot(old, tab)
    @assert.ok(old.window != null)
    @assert.ok(tab.window != null)
    @assert.is(old.window, tab.window)

    // When a tab is moved to a different window or closed, we don't want to unfocus it
    if (!(old.detached || old.closed)) {
      unfocusTab(old)
    }
  }
}

function addTabWithId(id, info) {
  @assert.ok(id != null)

  var window = windows_id ..@get(info.windowId)

  var tab = {
    __id__: info.id,

    __saved__: {
      id: id
    },

    id: id,
    window: window,
    focused: info.active,
    index: info.index,
    detached: false,
    closed: false
  }

  if (tab.focused) {
    focusTab(tab)
  }

  tabs_id ..@setNew(tab.__id__, tab)
  tab.window.tabs ..@spliceNew(tab.index, tab)
  tab.window.__saved__.tabs ..@spliceNew(tab.index, tab.__saved__)

  @assert.is(tab.index, info.index)
  @assert.is(tab.window.tabs[tab.index], tab)
  @assert.is(tab.window.__saved__.tabs[tab.index], tab.__saved__)
  updateIndexes(tab.window.tabs, tab.index + 1)

  checkTab(tab, info)
  setTab(tab, info)

  return tab
}

function addTab(info) {
  var id = @timestamp()
  return addTabWithId(id, info)
}

function removeTab(tab, info) {
  // When closing a focused tab it will:
  //
  //   1) send the close event for the closed tab
  //   2) send the focus event for the tab that is now being focused
  //   3) send the unfocus event for the closed tab
  //
  // We don't want to send any events after a tab has been closed,
  // so this code prevents #3 from happening
  //
  // TODO add in assertions to guarantee that events are not sent
  //      for closed tabs
  @assert.is(tab.closed, false)
  tab.closed = true

  @assert.ok(tab.index != null)
  @assert.is(tab.window.tabs[tab.index], tab)
  @assert.is(tab.window.__saved__.tabs[tab.index], tab.__saved__)

  tabs_id ..@delete(tab.__id__)
  tab.window.tabs ..@remove(tab)
  tab.window.__saved__.tabs ..@remove(tab.__saved__)

  updateIndexes(tab.window.tabs, tab.index)

  save()

  exports.tabs.on.remove ..@emit({
    tab: tab,
    // TODO this probably shouldn't be a part of the public API, because Jetpack may not be able to support it
    isWindowClosing: info.isWindowClosing
  })
}

// updateIndexes is unnecessary because windows are always added to the end
function addWindowWithId(id, info) {
  @assert.ok(id != null)

  var window = {
    __id__: info.id,

    __saved__: {
      id: id,
      tabs: []
    },

    id: id,
    focusedTab: null,
    tabs: []
  }

  windows_id ..@setNew(window.__id__, window)
  window.index = windows ..@pushNew(window) - 1
  windows_saved ..@pushNew(window.__saved__)

  @assert.is(windows[window.index], window)
  @assert.is(windows_saved[window.index], window.__saved__)

  save()

  return window
}

function addWindow(info) {
  var id = @timestamp()

  var window = addWindowWithId(id, info)

  // Oddly enough, Chrome windows sometimes don't have a tabs property
  if (info.tabs != null) {
    info.tabs ..@each(function (info) {
      addTab(info)
    })
  }

  return window
}

function removeWindow(window) {
  @assert.ok(window.index != null)
  @assert.is(windows[window.index], window)
  @assert.is(windows_saved[window.index], window.__saved__)

  windows_id ..@delete(window.__id__)
  windows ..@remove(window)
  windows_saved ..@remove(window.__saved__)

  updateIndexes(windows, window.index)

  save()

  exports.windows.on.remove ..@emit({
    window: window
  })
}


exports.windows.getCurrent = function () {
  return windows
}

exports.tabs.open = function (options) {
  if (options == null) {
    options = {}
  }

  // This is unnecessary since Chrome defaults to the new tab page,
  // but I prefer being explicit about it
  if (options.url == null) {
    options.url = @url.newTab
  }

  if (options.pinned == null) {
    options.pinned = false
  }

  if (options.focused == null) {
    options.focused = true
  }

  waitfor (var result) {
    chrome.tabs.create({
      url: options.url,
      pinned: options.pinned,
      active: options.focused
    }, function (info) {
      @checkError()

      // Chrome doesn't focus the window when focusing the tab,
      // so we have to do it manually in here
      if (options.focused) {
        chrome.windows.update(info.windowId, { focused: true })
      }

      var tab = tabs_id ..@get(info.id)
      @assert.is(tab.url, options.url)
      @assert.is(tab.pinned, options.pinned)
      @assert.is(tab.focused, options.focused)
      checkTab(tab, info)

      resume(tab)
    })
  // TODO test this
  } retract {
    throw new Error("cannot retract when creating a new tab")
  }
  return result
}


/*chrome.tabs.onCreated.addListener(function (tab) {
  console.log("tabs.onCreated")
})

chrome.tabs.onUpdated.addListener(function (id, info, tab) {
  console.log("tabs.onUpdated", tab)
})

chrome.tabs.onRemoved.addListener(function (id, info) {
  console.log("tabs.onRemoved")
})

chrome.tabs.onReplaced.addListener(function (added, removed) {
  console.log("tabs.onReplaced")
})

chrome.tabs.onActivated.addListener(function (info) {
  console.log("tabs.onActivated", info)
})

chrome.tabs.onMoved.addListener(function (id, info) {
  console.log("tabs.onMoved")
})

chrome.tabs.onDetached.addListener(function (id, info) {
  console.log("tabs.onDetached")
})

chrome.tabs.onAttached.addListener(function (id, info) {
  console.log("tabs.onAttached")
})

chrome.windows.onCreated.addListener(function (window) {
  console.log("windows.onCreated")
})

chrome.windows.onRemoved.addListener(function (id) {
  console.log("windows.onRemoved")
})

setTimeout(function () {
  chrome.tabs.create({}, function (tab) {
    console.log("tabs.create", tab)

    //chrome.windows.create({ tabId: tab.id }, function () {
      setTimeout(function () {
        chrome.tabs.move(tab.id, { index: 0 }, function (tab) {
          console.log("tabs.move", tab)
        })
        chrome.windows.getAll({ populate: true }, function (wins) {
          chrome.tabs.update(wins[0].tabs[0].id, { active: true }, function (tab) {
            console.log("tabs.update", tab)
          })
        })
        chrome.tabs.update(tab.id, { url: "http://google.com" }, function (tab) {
          console.log("tabs.update", tab)
        })
        chrome.tabs.remove(tab.id, function () {
          console.log("tabs.remove")
        })
      }, 5000)
    //})
  })
}, 5000)*/


/**
 * @ Tab lifecycle
 *
 *   @ When creating
 *     @ If it's a new window
 *       windows.onCreated
 *     tabs.onCreated
 *     tabs.onActivated
 *     tabs.create
 *     @ If it's not loaded from cache
 *       tabs.onUpdated
 *
 *   @ When updating
 *     tabs.update
 *     tabs.onUpdated
 *
 *   @ When focusing a different tab
 *     tabs.onActivated
 *     tabs.update
 *
 *   @ When moving in the same window
 *     tabs.onMoved
 *     tabs.move
 *
 *   @ When moving to another window
 *     @ If the old window still has tabs in it
 *       windows.onCreated
 *       tabs.onDetached
 *       tabs.onActivated (old window)
 *       tabs.onAttached
 *       tabs.onActivated (new window)
 *
 *       tabs.onDetached
 *       tabs.onAttached
 *       tabs.onActivated (new window)
 *       windows.onRemoved
 *
 *     @ If the old window does not still have tabs in it
 *       tabs.onDetached
 *       tabs.onAttached
 *       tabs.onActivated (new window)
 *       windows.onRemoved
 *
 *   @ When removing
 *     tabs.onRemoved
 *     @ If the old window still has tabs in it
 *       tabs.onActivated
 *       tabs.remove
 *     @ If the old window does not still have tabs in it
 *       tabs.remove
 *       windows.onRemoved
 */
mergeAllWindows(@getAllWindows() ..@filter(window -> window.type === "normal") ..@toArray)

chrome.tabs.onCreated.addListener(function (tab) {
  @checkError()

  // This is to make sure that we only handle tabs that are in windows with type "normal"
  var window = windows_id[tab.windowId]
  if (window != null) {
    exports.tabs.on.add ..@emit({
      tab: addTab(tab)
    })
  }
})

chrome.tabs.onUpdated.addListener(function (id, info, tab) {
  @checkError()

  @assert.is(tab.id, id)

  var old = tabs_id[id]
  if (old != null) {
    @assert.is(old.__id__, id)
    updateTab(old, tab)
  }
})

chrome.tabs.onRemoved.addListener(function (id, info) {
  @checkError()

  var tab = tabs_id[id]
  if (tab != null) {
    @assert.is(tab.__id__, id)
    removeTab(tab, info)
  }
})

// This event is fired when Chrome swaps in one renderer process for another
// I believe this happens when Chrome prerenders a page in the background (for faster loading)
chrome.tabs.onReplaced.addListener(function (added, removed) {
  @checkError()

  // Chrome only gives us the ID, not the actual tab, so we have to use this to get the tab
  // TODO should this use waitfor or something?
  chrome.tabs.get(added, function (tab) {
    @checkError()

    var old = tabs_id[removed]
    if (old != null) {
      @assert.ok(old.__id__ != null)
      @assert.isNot(old.__id__, tab.id)
      @assert.is(old.__id__, removed)
      @assert.is(tab.id, added)
      @assert.ok(windows_id[tab.windowId] != null)
      @assert.is(windows_id[tab.windowId], old.window)
      console.log("PLATFORM: REPLACING", old, tab)

      // Update the ID...
      tabs_id ..@delete(old.__id__)
      old.__id__ = tab.id
      tabs_id ..@setNew(old.__id__, old)

      // ...and then treat it as a normal tab update
      updateTab(old, tab)
    }
  })
})

chrome.tabs.onActivated.addListener(function (info) {
  @checkError()

  var tab = tabs_id[info.tabId]
  if (tab != null) {
    @assert.is(tab.__id__, info.tabId)
    @assert.is(tab.window.__id__, info.windowId)
    focusTab(tab)
  }
})

chrome.tabs.onMoved.addListener(function (id, info) {
  @checkError()

  var tab = tabs_id[id]
  if (tab != null) {
    @assert.is(tab.__id__, id)
    @assert.ok(tab.window != null)
    @assert.is(tab.window.__id__, info.windowId)
    @assert.isNot(info.fromIndex, info.toIndex)
    @assert.is(tab.index, info.fromIndex)
    @assert.is(tab.window.tabs[tab.index], tab)
    @assert.is(tab.window.__saved__.tabs[tab.index], tab.__saved__)

    var old = {
      window: tab.window,
      index: tab.index
    }

    tab.window.tabs ..@remove(tab)
    tab.window.__saved__.tabs ..@remove(tab.__saved__)

    tab.index = info.toIndex

    tab.window.tabs ..@spliceNew(tab.index, tab)
    tab.window.__saved__.tabs ..@spliceNew(tab.index, tab.__saved__)

    @assert.is(tab.index, info.toIndex)
    @assert.is(tab.window.tabs[tab.index], tab)
    @assert.is(tab.window.__saved__.tabs[tab.index], tab.__saved__)
    updateIndexes(tab.window.tabs, Math.min(info.fromIndex, info.toIndex + 1))

    save()

    exports.tabs.on.move ..@emit({
      tab: tab,
      old: old
    })
  }
})

chrome.tabs.onDetached.addListener(function (id, info) {
  @checkError()

  var tab = tabs_id[id]
  if (tab != null) {
    @assert.is(tab.__id__, id)
    @assert.ok(tab.window != null)
    @assert.is(tab.window.__id__, info.oldWindowId)
    @assert.is(tab.index, info.oldPosition)
    @assert.is(tab.window.tabs[tab.index], tab)
    @assert.is(tab.window.__saved__.tabs[tab.index], tab.__saved__)

    tab.window.tabs ..@remove(tab)
    tab.window.__saved__.tabs ..@remove(tab.__saved__)

    updateIndexes(tab.window.tabs, tab.index)

    @assert.is(tab.detached, false)
    tab.detached = true

    save()
  }
})

chrome.tabs.onAttached.addListener(function (id, info) {
  @checkError()

  var tab = tabs_id[id]
  if (tab != null) {
    @assert.is(tab.__id__, id)
    @assert.ok(tab.window != null)
    @assert.ok(tab.index != null)

    var old = {
      window: tab.window,
      index: tab.index
    }

    var window = windows_id ..@get(info.newWindowId)
    tab.window = window
    tab.index = info.newPosition

    tab.window.tabs ..@spliceNew(tab.index, tab)
    tab.window.__saved__.tabs ..@spliceNew(tab.index, tab.__saved__)

    @assert.ok(tab.index != null)
    @assert.is(tab.window.tabs[tab.index], tab)
    @assert.is(tab.window.__saved__.tabs[tab.index], tab.__saved__)
    updateIndexes(tab.window.tabs, tab.index + 1)

    @assert.is(tab.detached, true)
    tab.detached = false

    save()

    exports.tabs.on.move ..@emit({
      tab: tab,
      old: old
    })
  }
})

chrome.windows.onCreated.addListener(function (window) {
  @checkError()

  if (window.type === "normal") {
    exports.windows.on.add ..@emit({
      window: addWindow(window)
    })
  }
})

chrome.windows.onRemoved.addListener(function (id) {
  @checkError()

  var window = windows_id[id]
  if (window != null) {
    @assert.is(id, window.__id__)
    removeWindow(window)
  }
})
