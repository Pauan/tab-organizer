@ = require([
  { id: "./util" },
  { id: "./url", name: "url" },
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" },
  { id: "sjs:object" },
  { id: "sjs:event" }
])

exports.windows = {}

exports.tabs = {}
exports.tabs.on = {}
exports.tabs.on.add = @Emitter()
exports.tabs.on.update = @Emitter()
exports.tabs.on.remove = @Emitter()
exports.tabs.on.focus = @Emitter()
exports.tabs.on.move = @Emitter()

var windows_id = {}
var tabs_id    = {}

function getAllWindows() {
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

function convertWindow(window) {
  return {
    id: window.id,
    focusedTab: null,
    tabs: [] // TODO should this be private?
  }
}

// TODO normalize URL?
function convertTab(tab) {
  @assert.ok(arguments.length === 1) // TODO
  var window = windows_id[tab.windowId]
  @assert.ok(window != null)
  @assert.ok(tab.index != null)
  return {
    id: tab.id,
    window: window,
    url: tab.url,
    title: tab.title,
    pinned: tab.pinned,
    focused: tab.active,
    index: tab.index
  }
}

function addWindow(window) {
  @assert.ok(windows_id[window.id] == null)
  windows_id[window.id] = convertWindow(window)
}

function setFocus(tab) {
  if (tab.focused) {
    @assert.ok(tab.window != null)
    var old = tab.window.focusedTab
    if (old != null) {
      @assert.isNot(old, tab)
      @assert.is(old.focused, true)
      old.focused = false
    }
    @assert.is(tab.focused, true)
    tab.window.focusedTab = tab
  }
  return tab
}

function removeFocus(tab) {
  if (tab.window.focusedTab === tab) {
    @assert.is(tab.focused, true)
    tab.window.focusedTab = null
  } else {
    @assert.is(tab.focused, false)
  }
}

function setTab(tab) {
  tabs_id[tab.id] = tab
  return tab
}

function push(tab) {
  @assert.ok(tab.window != null)
  @assert.is(tab.window.tabs.indexOf(tab), -1)
  @assert.ok(tab.index != null)
  tab.window.tabs.splice(tab.index, 0, tab)
  return tab
}

function pop(tab) {
  @assert.ok(tab.window != null)
  var index = tab.window.tabs.indexOf(tab)
  @assert.isNot(index, -1)
  tab.window.tabs.splice(index, 1)
  return tab
}

function addTab(tab) {
  @assert.ok(arguments.length === 1) // TODO
  @assert.ok(tabs_id[tab.id] == null)
  return push(setFocus(setTab(convertTab(tab))))
}

function removeTab(tab) {
  @assert.ok(tabs_id[tab.id] != null)
  @assert.is(tabs_id[tab.id], tab)
  delete tabs_id[tab.id]
  pop(tab)
  removeFocus(tab)
  return tab
}

exports.tabs.getCurrent = function () {
  var result = []
  getAllWindows() ..@each(function (window) {
    if (window.type === "normal") {
      window.tabs ..@each(function (tab) {
        result.push(convertTab(tab))
      })
    }
  })
  return result
}

// TODO chrome.windows.onCreated/onRemoved
getAllWindows() ..@each(function (window) {
  if (window.type === "normal") {
    addWindow(window)

    window.tabs ..@each(function (tab) {
      addTab(tab)
    })
  }
})

chrome.tabs.onCreated.addListener(function (tab) {
  @checkError()

  var window = windows_id[tab.windowId]
  if (window != null) {
    exports.tabs.on.add.emit({
      tab: addTab(tab)
    })
  }
})

chrome.tabs.onUpdated.addListener(function (id, info, tab) {
  @checkError()

  if (windows_id[tab.windowId] != null) {
    var old = tabs_id[tab.id]
    @assert.ok(old != null)
    @assert.ok(old.index != null)
    @assert.is(old.index, tab.index)
    @assert.ok(old.window != null)
    @assert.is(old.window.tabs[tab.index], old)

    var new_tab = setTab(convertTab(tab))
    @assert.is(old.focused, new_tab.focused)
    setFocus(new_tab)

    old.window.tabs[tab.index] = new_tab

    exports.tabs.on.update.emit({
      tab: new_tab,
      old: old
    })
  }
})

chrome.tabs.onRemoved.addListener(function (id, info) {
  @checkError()

  var tab = tabs_id[id]
  if (tab != null) {
    @assert.is(tab.id, id)
    removeTab(tab)

    exports.tabs.on.remove.emit({
      tab: tab,
      // TODO this probably shouldn't be a part of the public API, because Jetpack may not be able to support it
      isWindowClosing: info.isWindowClosing
    })
  }
})

chrome.tabs.onReplaced.addListener(function (added, removed) {
  @checkError()

  // TODO should this use waitfor or something?
  chrome.tabs.get(added, function (tab) {
    @checkError()

    var old = tabs_id[removed]
    if (old != null) {
      @assert.ok(old.id != null)
      @assert.isNot(old.id, tab.id)
      @assert.is(old.id, removed)
      @assert.is(tab.id, added)
      @assert.ok(windows_id[tab.windowId] != null)
      console.log("PLATFORM: REPLACING", old, tab)

      removeTab(old)

      exports.tabs.on.update.emit({
        tab: addTab(tab),
        old: old
      })
    }
  })
})

chrome.tabs.onActivated.addListener(function (info) {
  var tab = tabs_id[info.tabId]
  if (tab != null) {
    @assert.is(tab.id, info.tabId)
    @assert.is(tab.window.id, info.windowId)

    var old = tab.window.focusedTab
    if (old != null) {
      @assert.isNot(old, tab)
      @assert.is(old.focused, true)
      old.focused = false

      //@assert.is(tab.focused, false)
      tab.focused = true
      tab.window.focusedTab = tab

      exports.tabs.on.focus.emit({
        old: old,
        tab: tab
      })
    }
  }
})

chrome.tabs.onMoved.addListener(function (id, info) {
  var tab = tabs_id[id]
  if (tab != null) {
    @assert.is(tab.id, id)
    @assert.ok(tab.window != null)
    @assert.is(tab.window.id, info.windowId)
    @assert.is(tab.index, info.fromIndex)

    pop(tab)
    tab.index = info.toIndex
    push(tab)

    exports.tabs.on.move.emit({
      tab: tab
    })
  }
})

chrome.tabs.onDetached.addListener(function (id, info) {
  var tab = tabs_id[id]
  if (tab != null) {
    @assert.is(tab.id, id)
    @assert.ok(tab.window != null)
    @assert.is(tab.window.id, info.oldWindowId)
    @assert.is(tab.index, info.oldPosition)

    pop(tab)
    //removeFocus(tab)
    tab.window = null
    tab.index = null
    //tab.focused = false
  }
})

chrome.tabs.onAttached.addListener(function (id, info) {
  var tab = tabs_id[id]
  if (tab != null) {
    @assert.is(tab.id, id)
    @assert.ok(tab.window == null)
    @assert.ok(tab.index == null)

    var window = windows_id[info.newWindowId]
    @assert.ok(window != null)

    tab.window = window
    tab.index = info.newPosition
    push(tab)
    //setFocus(tab) // TODO this is basically unnecessary, but I'm leaving it in anyways for symmetry with onDetached

    exports.tabs.on.move.emit({
      tab: tab
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

  if (windows_id[id] != null) {
    delete windows_id[id]
  }
})

exports.tabs.open = function (options) {
  if (options == null) {
    options = {}
  }

  if (options.url == null) {
    options.url = @url.newTab
  }

  if (options.pinned == null) {
    options.pinned = false
  }

  if (options.focused == null) {
    options.focused = true
  }

  // TODO what about retraction ?
  waitfor (var result) {
    chrome.tabs.create({
      url: options.url,
      pinned: options.pinned,
      active: options.focused
    }, function (tab) {
      @checkError()
      if (options.focused) {
        chrome.windows.update(tab.windowId, { focused: true })
      }
      resume(convertTab(tab))
    })
  }
  return result
}
