// TODO it's okay to remove the index property from tabs, if it's not needed

@ = require([
  { id: "../../util/util" },
  { id: "../../util/event" },
  { id: "./util" },
  { id: "./url", name: "url" },
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" },
  { id: "sjs:object" }
])

exports.windows = {}

exports.tabs = {}
exports.tabs.on = {}
exports.tabs.on.changeId = @Emitter()
exports.tabs.on.changeParent = @Emitter()
exports.tabs.on.add = @Emitter()
exports.tabs.on.update = @Emitter()
exports.tabs.on.remove = @Emitter()
exports.tabs.on.focus = @Emitter()
exports.tabs.on.unfocus = @Emitter()
exports.tabs.on.move = @Emitter()

var windows    = []
var windows_id = {}
var tabs_id    = {}

function getAllWindows() {
  // This is necessary because sometimes Chrome will give incorrect results for
  // chrome.windows.getAll if you call it before the window.onload event
  // TODO perhaps this was only true in old versions, and I can remove this now?
  @waitUntilLoaded()
  // TODO what about retraction?
  waitfor (var result) {
    chrome.windows.getAll({ populate: true }, function (windows) {
      @checkError()
      resume(windows)
    })
  }
  return result
}


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
  @assert.ok(tabs_id ..@has(tab.id))
  @assert.is(tab.closed, false)
  @assert.ok(info.index != null)
  @assert.ok(tab.window != null)
  @assert.is(tab.window.tabs[info.index], tab)

  @assert.is(tab.id, info.id)
  @assert.is(tab.window.id, info.windowId)
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
  tab.url = info.url
  tab.favicon = "chrome://favicon/" + info.url
  tab.title = info.title
  tab.pinned = info.pinned
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

function addTab(info) {
  var window = windows_id ..@get(info.windowId)

  var tab = {
    id: info.id,
    window: window,
    focused: info.active,
    children: [],
    index: info.index,
    detached: false,
    closed: false
  }

  if (info.openerTabId == null) {
    tab.parentTab = null
  } else {
    tab.parentTab = tabs_id ..@get(info.openerTabId)
    tab.parentTab.children ..@pushNew(tab)
  }

  if (tab.focused) {
    focusTab(tab)
  }

  tabs_id ..@setNew(tab.id, tab)
  tab.window.tabs ..@spliceNew(tab.index, tab)

  @assert.is(tab.index, info.index)
  @assert.is(tab.window.tabs[tab.index], tab)
  updateIndexes(tab.window.tabs, tab.index + 1)

  checkTab(tab, info)
  setTab(tab, info)

  return tab
}

function shiftChildrenUp(tab, event) {
  @assert.isNot(tab.parentTab, tab)

  tab.children ..@each(function (child) {
    @assert.is(child.parentTab, tab)
    child.parentTab = tab.parentTab

    exports.tabs.on.changeParent ..@emit({
      tab: child
    })
  })

  tab.children = []

  if (tab.parentTab != null) {
    tab.parentTab.children ..@remove(tab)
    tab.parentTab = null

    if (event) {
      exports.tabs.on.changeParent ..@emit({
        tab: tab
      })
    }
  }
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

  tabs_id ..@delete(tab.id)
  tab.window.tabs ..@remove(tab)

  updateIndexes(tab.window.tabs, tab.index)

  shiftChildrenUp(tab, false)

  exports.tabs.on.remove ..@emit({
    tab: tab,
    // TODO this probably shouldn't be a part of the public API, because Jetpack may not be able to support it
    isWindowClosing: info.isWindowClosing
  })
}

function addWindow(info) {
  var window = {
    id: info.id,
    focusedTab: null,
    tabs: []
  }

  windows_id ..@setNew(window.id, window)
  windows ..@pushNew(window)

  // Oddly enough, Chrome windows sometimes don't have a tabs property
  if (info.tabs != null) {
    info.tabs ..@each(function (info) {
      @assert.is(info.windowId, window.id)
      addTab(info)
    })
  }

  return window
}

function removeWindow(window) {
  windows_id ..@delete(window.id)
  windows ..@remove(window)
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
getAllWindows() ..@each(function (window) {
  if (window.type === "normal") {
    addWindow(window)
  }
})

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
    @assert.is(old.id, id)
    updateTab(old, tab)
  }
})

chrome.tabs.onRemoved.addListener(function (id, info) {
  @checkError()

  var tab = tabs_id[id]
  if (tab != null) {
    @assert.is(tab.id, id)
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
      // Since the ID of the tab has changed, we give app code a chance to update any ID references it might have
      // TODO should this be moved to after the ID is changed, but before updateTab is called?
      exports.tabs.on.changeId ..@emit({
        oldId: removed,
        newId: added
      })

      @assert.ok(old.id != null)
      @assert.isNot(old.id, tab.id)
      @assert.is(old.id, removed)
      @assert.is(tab.id, added)
      @assert.ok(windows_id[tab.windowId] != null)
      @assert.is(windows_id[tab.windowId], old.window)
      console.log("PLATFORM: REPLACING", old, tab)

      // Update the ID...
      tabs_id ..@delete(old.id)
      old.id = tab.id
      tabs_id ..@setNew(old.id, old)

      // ...and then treat it as a normal tab update
      updateTab(old, tab)
    }
  })
})

chrome.tabs.onActivated.addListener(function (info) {
  @checkError()

  var tab = tabs_id[info.tabId]
  if (tab != null) {
    @assert.is(tab.id, info.tabId)
    @assert.is(tab.window.id, info.windowId)
    focusTab(tab)
  }
})

chrome.tabs.onMoved.addListener(function (id, info) {
  @checkError()

  var tab = tabs_id[id]
  if (tab != null) {
    @assert.is(tab.id, id)
    @assert.ok(tab.window != null)
    @assert.is(tab.window.id, info.windowId)
    @assert.isNot(info.fromIndex, info.toIndex)
    @assert.is(tab.index, info.fromIndex)
    @assert.is(tab.window.tabs[tab.index], tab)

    var old = {
      window: tab.window,
      index: tab.index
    }

    tab.window.tabs ..@remove(tab)
    tab.index = info.toIndex
    tab.window.tabs ..@spliceNew(tab.index, tab)

    @assert.is(tab.index, info.toIndex)
    @assert.is(tab.window.tabs[tab.index], tab)
    updateIndexes(tab.window.tabs, Math.min(info.fromIndex, info.toIndex + 1))

    shiftChildrenUp(tab, true)

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
    @assert.is(tab.id, id)
    @assert.ok(tab.window != null)
    @assert.is(tab.window.id, info.oldWindowId)
    @assert.is(tab.index, info.oldPosition)
    @assert.is(tab.window.tabs[tab.index], tab)

    tab.window.tabs ..@remove(tab)

    updateIndexes(tab.window.tabs, tab.index)

    @assert.is(tab.detached, false)
    tab.detached = true
  }
})

chrome.tabs.onAttached.addListener(function (id, info) {
  @checkError()

  var tab = tabs_id[id]
  if (tab != null) {
    @assert.is(tab.id, id)
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

    @assert.ok(tab.index != null)
    @assert.is(tab.window.tabs[tab.index], tab)
    updateIndexes(tab.window.tabs, tab.index + 1)

    @assert.is(tab.detached, true)
    tab.detached = false

    shiftChildrenUp(tab, true)

    exports.tabs.on.move ..@emit({
      tab: tab,
      old: old
    })
  }
})

chrome.windows.onCreated.addListener(function (window) {
  @checkError()

  if (window.type === "normal") {
    addWindow(window)
  }
})

chrome.windows.onRemoved.addListener(function (id) {
  @checkError()

  var window = windows_id[id]
  if (window != null) {
    @assert.is(id, window.id)
    removeWindow(window)
  }
})
