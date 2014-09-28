/**
 * Functions for dealing with Chrome's asynchronousness
 */

/*chrome.tabs.onCreated.addListener(function (tab) {
  console.debug("tabs.onCreated")
})

chrome.tabs.onUpdated.addListener(function (id, info, tab) {
  console.debug("tabs.onUpdated", tab)
})

chrome.tabs.onRemoved.addListener(function (id, info) {
  console.debug("tabs.onRemoved")
})

chrome.tabs.onReplaced.addListener(function (added, removed) {
  console.debug("tabs.onReplaced")
})

chrome.tabs.onActivated.addListener(function (info) {
  console.debug("tabs.onActivated", info)
})

chrome.tabs.onMoved.addListener(function (id, info) {
  console.debug("tabs.onMoved")
})

chrome.tabs.onDetached.addListener(function (id, info) {
  console.debug("tabs.onDetached")
})

chrome.tabs.onAttached.addListener(function (id, info) {
  console.debug("tabs.onAttached")
})

chrome.windows.onCreated.addListener(function (window) {
  console.debug("windows.onCreated")
})

chrome.windows.onRemoved.addListener(function (id) {
  console.debug("windows.onRemoved", id)
})

chrome.windows.create({}, function (window) {
  chrome.windows.remove(window.id, function () {
    console.debug("windows.remove", window.id)
  })
})

setTimeout(function () {
  chrome.tabs.create({}, function (tab) {
    console.debug("tabs.create", tab)

    //chrome.windows.create({ tabId: tab.id }, function () {
      setTimeout(function () {
        chrome.tabs.move(tab.id, { index: 0 }, function (tab) {
          console.debug("tabs.move", tab)
        })
        chrome.windows.getAll({ populate: true }, function (wins) {
          chrome.tabs.update(wins[0].tabs[0].id, { active: true }, function (tab) {
            console.debug("tabs.update", tab)
          })
        })
        chrome.tabs.update(tab.id, { url: "http://google.com" }, function (tab) {
          console.debug("tabs.update", tab)
        })
        chrome.tabs.remove(tab.id, function () {
          console.debug("tabs.remove")
        })
      }, 5000)
    //})
  })
}, 5000)*/


/**
 * @ Tab lifecycle
 *
 *   @ When removing a window
 *     windows.remove
 *     windows.onRemoved
 *
 *   @ When creating
 *     @ If it's a new window
 *       windows.onFocusChanged (old)
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
 *
 *
 * windows.onCreated
 */
@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:object" },
  { id: "sjs:sequence" },
  { id: "lib:util/event" },
  { id: "lib:util/util" },
  { id: "../util" },
  { id: "./url", name: "url" }
])
/*
var o = {}

  o.type = "normal"
  o.url = info.url

  // TODO util for this
  if (info.focused == null) {
    o.focused = true
  } else {
    o.focused = info.focused
  }
  */

var window_focused     = null  // The window id which was last focused
var window_focused_tab = {}    // The tab which was last focused (per window id)

var windows_by_id      = {}    // Normal windows (per id)
var popups_by_id       = {}    // Popups (per id)
var tabs_by_id         = {}    // Tabs (per id)

exports.windows = {}
exports.tabs    = {}
exports.popup   = {}

exports.tabs.events  = @Emitter()
exports.popup.events = @Emitter()

function emit(o) {
  exports.tabs.events ..@emit(o)
}


function windows_get(id) {
  waitfor (var err, result) {
    chrome.windows.get(id, function (window) {
      var err = @checkError()
      if (err) {
        resume(err)
      } else {
        resume(null, window)
      }
    })
  // TODO this probably isn't necessary
  } retract {
    throw new Error("extension.chrome.tabs: cannot retract when getting a window")
  }

  if (err) {
    throw err
  } else {
    return result
  }
}

function windows_update(id, info) {
  waitfor (var err, result) {
    chrome.windows.update(id, info, function (window) {
      var err = @checkError()
      if (err) {
        resume(err)
      } else {
        resume(null, window)
      }
    })
  } retract {
    throw new Error("extension.chrome.tabs: cannot retract when updating a window")
  }

  if (err) {
    throw err
  } else {
    return result
  }
}

function tabs_update(id, info) {
  waitfor (var err, result) {
    chrome.tabs.update(id, info, function (tab) {
      var err = @checkError()
      if (err) {
        resume(err)
      } else {
        resume(null, tab)
      }
    })
  } retract {
    throw new Error("extension.chrome.tabs: cannot retract when updating a tab")
  }

  if (err) {
    throw err
  } else {
    return result
  }
}

function tabs_get(id) {
  waitfor (var err, result) {
    chrome.tabs.get(id, function (tab) {
      var err = @checkError()
      if (err) {
        resume(err)
      } else {
        resume(null, tab)
      }
    })
  // TODO this probably isn't necessary
  } retract {
    throw new Error("extension.chrome.tabs: cannot retract when getting a tab")
  }

  if (err) {
    throw err
  } else {
    return result
  }
}


function create_tab(tab) {
  return {
    id: tab.id,
    index: tab.index,
    focused: tab.active,
    pinned: tab.pinned,
    url: tab.url,
    title: tab.title,
    // TODO maybe this should always use chrome://favicon/ ?
    favicon: (tab.favIconUrl || "chrome://favicon/#{tab.url}")
  }
}

function create_window(window) {
  return {
    id: window.id,
    focused: window.focused,
    // TODO
    "private": window.incognito,
    tabs: (window.tabs
            ? window.tabs ..@map(create_tab)
            : [])
  }
}

function create_popup(window) {
  return {
    id: window.id,
    type: window.type,
    focused: window.focused,
    // TODO
    "private": window.incognito
  }
}

function tab_created(tab) {
  return {
    window: {
      id: tab.windowId,
      // TODO
      "private": tab.incognito
    },
    tab: create_tab(tab)
  }
}

function should_update(old, tab) {
  return old.url        !== tab.url    ||
         old.pinned     !== tab.pinned ||
         old.title      !== tab.title  ||
         old.favIconUrl !== tab.favIconUrl
}

function emit_update_tab(tab) {
  var old = tabs_by_id ..@get(tab.id)

  @assert.is(old.id, tab.id)
  @assert.is(old.active, tab.active)
  @assert.is(old.incognito, tab.incognito)
  //@assert.is(old.index, tab.index)
  @assert.is(old.windowId, tab.windowId)

  // We want every property on `old` to be the same
  old.index = tab.index

  if (should_update(old, tab)) {
    var tab_before = tab_created(old)

    old.url = tab.url
    old.pinned = tab.pinned
    old.title = tab.title
    old.favIconUrl = tab.favIconUrl

    emit({
      type: "tabs.update",
      before: tab_before,
      after: tab_created(tab)
    })
  }
}

function unfocus_tab(tab) {
  var old = window_focused_tab ..@get(tab.windowId)
  if (old !== null && old === tab) {
    window_focused_tab ..@set(tab.windowId, null)
  }
}

// TODO what if the "load" event never fires?
function waitUntilLoaded() {
  @assert.ok(typeof document.readyState === "string")

  if (document.readyState !== "complete") {
    waitfor () {
      addEventListener("load", resume, true)
    } finally {
      removeEventListener("load", resume, true)
    }
  }
}

function setCoordinates(o, info) {
  // TODO test these
  if (info.left != null) {
    o.left = info.left
  }
  if (info.top != null) {
    o.top = info.top
  }
  if (info.width != null) {
    o.width = info.width
  }
  if (info.height != null) {
    o.height = info.height
  }
}

function windows_getAll() {
  // This is necessary because sometimes Chrome will give incorrect results for
  // chrome.windows.getAll if you call it before the window.onload event
  // TODO perhaps this was only true in old versions, and I can remove this now?
  waitUntilLoaded()

  // TODO what about retraction?
  waitfor (var err, result) {
    chrome.windows.getAll({ populate: true }, function (windows) {
      var err = @checkError()
      if (err) {
        resume(err)
      } else {
        resume(null, windows)
      }
    })
  }

  if (err) {
    throw err
  } else {
    return result
  }
}

// TODO if using left/top/width/height, the window will have very slightly incorrect dimensions
//      this can be fixed by calling exports.windows.move afterwards, but it'd be nice if
//      exports.windows.open would Just Work(tm)
function windows_open(info) {
  var o = {}

  setCoordinates(o, info)

  if (info.url != null) {
    o.url = info.url

  // This is unnecessary since Chrome defaults to the new tab page,
  // but I prefer being explicit about it
  } else {
    o.url = @url.newTab
  }

  if (info.focused != null) {
    o.focused = info.focused
  } else {
    o.focused = true
  }

  // TODO
  if (info["private"] != null) {
    o.incognito = info["private"]
  }

  o.type = info ..@get("type")

  waitfor (var err, result) {
    chrome.windows.create(o, function (window) {
      var err = @checkError()
      if (err) {
        resume(err)
      } else {
        resume(null, window)
      }
    })
  } retract {
    throw new Error("extension.chrome.windows: cannot retract when opening new window")
  }

  if (err) {
    throw err
  } else {
    return result
  }
}

function windows_isNormal(window) {
  return window.type === "normal"
}

function windows_isPopup(window) {
  return window.type === "popup" || window.type === "panel"
}


exports.windows.getCurrent = function () {
  return windows_getAll()
    ..@filter(windows_isNormal)
    ..@map(create_window)
}

exports.popup.getCurrent = function () {
  return windows_getAll()
    ..@filter(windows_isPopup)
    ..@map(create_popup)
}

exports.windows.open = function (info) {
  info ..@setNew("type", "normal")
  return create_window(windows_open(info))
}

exports.popup.open = function (info) {
  if (info ..@has("type")) {
    var type = info ..@get("type")
    @assert.ok(type === "popup" || type === "panel")
  } else {
    info ..@setNew("type", "popup")
  }
  return create_popup(windows_open(info))
}

exports.windows.getDimensions = exports.popup.getDimensions = function (id) {
  var state = windows_get(id)

  return {
    left: state.left,
    top: state.top,
    width: state.width,
    height: state.height
  }
}

exports.windows.minimize = exports.popup.minimize = function (id) {
  var state = windows_get(id)

  // TODO test this
  if (state.state === "normal" || state.state === "maximized") {
    // TODO do we need to set its state to normal first, like with exports.windows.maximize?
    windows_update(id, { state: "minimized" })
  }
}

exports.windows.unminimize = exports.popup.unminimize = function (id) {
  var state = windows_get(id)

  // TODO test this
  if (state.state === "minimized") {
    // TODO do we need to set its state to minimized first, like with exports.windows.maximize?
    windows_update(id, { state: "normal" })
  }
}

exports.windows.maximize = exports.popup.maximize = function (id) {
  var state = windows_get(id)

  // TODO test this
  if (state.state === "normal") {
    // TODO needed because Chrome is retarded
    windows_update(id, { state: "normal" })
    windows_update(id, { state: "maximized" })
  }
}

exports.windows.unmaximize = exports.popup.unmaximize = function (id) {
  var state = windows_get(id)

  // TODO test this
  if (state.state === "maximized") {
    // TODO do we need to set its state to maximized first, like with exports.windows.maximize?
    windows_update(id, { state: "normal"/*, focused: false*/ })
  }
}

// TODO can popups be fullscreened ?
exports.windows.fullscreen = function (id) {
  var state = windows_get(id)

  // TODO test this
  if (state.state === "normal" || state.state === "maximized") {
    // TODO do we need to set its state to normal first, like with exports.windows.maximize?
    windows_update(id, { state: "fullscreen" })
  }
}

// TODO can popups be fullscreened ?
exports.windows.unfullscreen = function (id) {
  var state = windows_get(id)

  // TODO test this
  if (state.state === "fullscreen") {
    // TODO do we need to set its state to fullscreen first, like with exports.windows.maximize?
    windows_update(id, { state: "normal" })
  }
}

// TODO what about unfocus ?
exports.windows.focus = exports.popup.focus = function (id) {
  windows_update(id, { focused: true })
}

exports.windows.move = exports.popup.move = function (id, info) {
  var state = windows_get(id)

  // TODO test this
  if (state.state === "normal" || state.state === "maximized") {
    //windows_update(id, { state: "normal" })

    var o = {}
    o.state = "normal"
    setCoordinates(o, info)

    windows_update(id, o)
    // TODO needed because Chrome is retarded
    //hold(100)
    //windows_update(id, o)
  }
}

exports.windows.close = exports.popup.close = function (id) {
  waitfor (var err) {
    chrome.windows.remove(id, function () {
      var err = @checkError()
      if (err) {
        resume(err)
      } else {
        resume(null)
      }
    })
  } retract {
    throw new Error("extension.chrome.windows: cannot retract when closing a window")
  }

  if (err) {
    throw err
  }
}


exports.tabs.open = function (info) {
  var o = {}

  if (info.url != null) {
    o.url = info.url

  // This is unnecessary since Chrome defaults to the new tab page,
  // but I prefer being explicit about it
  } else {
    o.url = @url.newTab
  }

  if (info.pinned != null) {
    o.pinned = info.pinned
  }

  if (info.focused != null) {
    o.active = info.focused
  } else {
    o.active = true
  }

  waitfor (var err, result) {
    chrome.tabs.create(o, function (tab) {
      var err = @checkError()
      if (err) {
        resume(err)
      } else {
        resume(null, tab)
      }
    })
  // TODO test this
  } retract {
    throw new Error("extension.chrome.tabs: cannot retract when opening a new tab")
  }

  if (err) {
    throw err
  } else {
    // Chrome doesn't focus the window when focusing the tab,
    // so we have to do it manually in here
    // TODO test this
    if (o.active) {
      exports.windows.focus(result.windowId)
    }

    return result
  }
}

exports.tabs.update = function (id, info) {
  var o = {}

  if (info.url != null) {
    o.url = info.url
  }

  if (info.pinned != null) {
    o.pinned = info.pinned
  }

  tabs_update(id, o)
}

exports.tabs.focus = function (id) {
  var tab = tabs_update(id, { active: true })

  // Chrome doesn't focus the window when focusing the tab,
  // so we have to do it manually in here
  // TODO would be nice to be able to do this in parallel with the tab update...
  // TODO test this
  exports.windows.focus(tab.windowId)
}

exports.tabs.close = function (id) {
  waitfor (var err) {
    chrome.tabs.remove(id, function () {
      var err = @checkError()
      if (err) {
        resume(err)
      } else {
        resume(null)
      }
    })
  } retract {
    throw new Error("extension.chrome.tabs: cannot retract when closing a tab")
  }

  if (err) {
    throw err
  }
}


chrome.windows.onCreated.addListener(function (window) {
  @throwError()

  @assert.is(window.focused, false)

  if (window.tabs) {
    @assert.is(window.tabs.length, 0)
    /*window.tabs ..@each(function (tab) {
      @assert.is(tab.active, false)
    })*/
  }

  if (windows_isNormal(window)) {
    @assert.is(popups_by_id ..@has(window.id), false)

    windows_by_id ..@setNew(window.id, window)
    window_focused_tab ..@setNew(window.id, null)

    emit({
      type: "windows.open",
      after: {
        window: create_window(window)
      }
    })

  } else if (windows_isPopup(window)) {
    @assert.is(windows_by_id ..@has(window.id), false)

    popups_by_id ..@setNew(window.id, window)

    exports.popup.events ..@emit({
      type: "popup.open",
      after: {
        popup: create_popup(window)
      }
    })
  }
})

chrome.windows.onFocusChanged.addListener(function (id) {
  @throwError()

  var popup_event = {
    type: "popup.focus"
  }

  var window_event = {
    type: "windows.focus"
  }

  // TODO what about when the window was closed ?
  if (window_focused !== null) {
    if (windows_by_id ..@has(window_focused)) {
      @assert.is(popups_by_id ..@has(window_focused), false)

      window_event.before = {
        window: {
          id: window_focused
        }
      }

    } else if (popups_by_id ..@has(window_focused)) {
      @assert.is(windows_by_id ..@has(window_focused), false)

      popup_event.before = {
        popup: {
          id: window_focused
        }
      }
    }
  }

  // If focusing an incognito window, or if all Chrome windows become unfocused
  if (id === chrome.windows.WINDOW_ID_NONE) {
    // window_focused is null when focusing an incognito window or when closing a window
    if (window_focused !== null) {
      window_focused = null
    }

  } else {
    @assert.isNot(window_focused, id)
    window_focused = id

    if (windows_by_id ..@has(id)) {
      @assert.is(popups_by_id ..@has(id), false)

      window_event.after = {
        window: {
          id: id
        }
      }
    } else if (popups_by_id ..@has(id)) {
      @assert.is(windows_by_id ..@has(id), false)

      popup_event.after = {
        popup: {
          id: id
        }
      }
    }
  }

  if (window_event.before || window_event.after) {
    emit(window_event)
  }
  if (popup_event.before || popup_event.after) {
    exports.popup.events ..@emit(popup_event)
  }
})

// TODO what about unfocusing ?
chrome.windows.onRemoved.addListener(function (id) {
  @throwError()

  // This is so that it doesn't show up in a "window.focus" event after it's closed
  // TODO test this
  if (window_focused !== null && window_focused === id) {
    window_focused = null
  }

  if (windows_by_id ..@has(id)) {
    @assert.is(popups_by_id ..@has(id), false)

    windows_by_id ..@delete(id)
    window_focused_tab ..@delete(id)

    emit({
      type: "windows.close",
      before: {
        window: {
          id: id
        }
      }
    })

  } else if (popups_by_id ..@has(id)) {
    @assert.is(windows_by_id ..@has(id), false)

    popups_by_id ..@delete(id)

    exports.popup.events ..@emit({
      type: "popup.close",
      before: {
        popup: {
          id: id
        }
      }
    })
  }
})

chrome.tabs.onCreated.addListener(function (tab) {
  @throwError()

  // This is so that only tabs in normal windows will be emitted
  if (windows_by_id ..@has(tab.windowId)) {
    @assert.is(popups_by_id ..@has(tab.windowId), false)

    tabs_by_id ..@setNew(tab.id, tab)

    @assert.is(tab.active, false)

    emit({
      type: "tabs.open",
      after: tab_created(tab)
    })
  }
})

chrome.tabs.onUpdated.addListener(function (id, info, tab) {
  @throwError()

  @assert.is(tab.id, id)

  if (tabs_by_id ..@has(id)) {
    emit_update_tab(tab)
  }
})

chrome.tabs.onReplaced.addListener(function (added, removed) {
  @throwError()

  @assert.isNot(added, removed)

  if (tabs_by_id ..@has(removed)) {
    var old = tabs_by_id ..@get(removed)
    @assert.is(old.id, removed)
    tabs_by_id ..@delete(removed)
    old.id = added
    tabs_by_id ..@setNew(added, old)

    emit({
      type: "tabs.replace",
      before: {
        tab: {
          id: removed
        }
      },
      after: {
        tab: {
          id: added
        }
      }
    })

    // TODO is this part necessary ?
    var tab = tabs_get(added)
    console.debug("TABS.ONREPLACED", old, tab)
    @assert.is(tab.id, added)
    emit_update_tab(tab)
  }
})

chrome.tabs.onActivated.addListener(function (info) {
  @throwError()

  if (tabs_by_id ..@has(info.tabId)) {
    var tab = tabs_by_id ..@get(info.tabId)
    @assert.is(tab.id, info.tabId)
    @assert.is(tab.windowId, info.windowId)

    var o = {
      type: "tabs.focus"
    }

    var old = window_focused_tab ..@get(tab.windowId)
    if (old !== null) {
      @assert.is(old.windowId, tab.windowId)
      @assert.is(old.active, true)
      old.active = false

      o.before = {
        window: {
          id: old.windowId
        },
        tab: {
          id: old.id
        }
      }
    }

    // TODO setUnique
    @assert.isNot(old, tab)
    window_focused_tab ..@set(tab.windowId, tab)

    // This is needed so that moving tabs between windows doesn't fire an extra focus event
    if (!tab.active) {
      tab.active = true

      o.after = {
        window: {
          id: tab.windowId
        },
        tab: {
          id: tab.id
        }
      }
    }

    if (o.before || o.after) {
      emit(o)
    }
  }
})

chrome.tabs.onMoved.addListener(function (id, info) {
  @throwError()

  if (tabs_by_id ..@has(id)) {
    emit({
      type: "tabs.move",
      before: {
        window: {
          id: info.windowId
        },
        tab: {
          id: id,
          index: info.fromIndex
        }
      },
      after: {
        window: {
          id: info.windowId
        },
        tab: {
          id: id,
          index: info.toIndex
        }
      }
    })
  }
})

// TODO what about tab focus ?
chrome.tabs.onDetached.addListener(function (id, info) {
  @throwError()

  if (tabs_by_id ..@has(id)) {
    var tab = tabs_by_id ..@get(id)

    unfocus_tab(tab)

    delete tab.windowId

    emit({
      type: "tabs.move",
      before: {
        window: {
          id: info.oldWindowId
        },
        tab: {
          id: id,
          index: info.oldPosition
        }
      },
      after: {
        tab: {
          id: id
        }
      }
    })
  }
})

// TODO what about tab focus ?
chrome.tabs.onAttached.addListener(function (id, info) {
  @throwError()

  if (tabs_by_id ..@has(id)) {
    var tab = tabs_by_id ..@get(id)
    tab.windowId = info.newWindowId

    emit({
      type: "tabs.move",
      before: {
        tab: {
          id: id
        }
      },
      after: {
        window: {
          id: info.newWindowId
        },
        tab: {
          id: id,
          index: info.newPosition
        }
      }
    })
  }
})

chrome.tabs.onRemoved.addListener(function (id, info) {
  @throwError()

  if (tabs_by_id ..@has(id)) {
    var old = tabs_by_id ..@get(id)
    @assert.is(old.id, id)
    @assert.is(old.windowId, info.windowId)

    // This is so that it doesn't show up in a "tab.focus" event after it's closed
    unfocus_tab(old)

    tabs_by_id ..@delete(id)

    emit({
      type: "tabs.close",
      before: {
        window: {
          id: info.windowId,
          closing: info.isWindowClosing // TODO probably not cross-platform with Jetpack
        },
        tab: {
          id: id
        }
      }
    })
  }
})


windows_getAll() ..@each(function (window) {
  if (window.focused) {
    @assert.is(window_focused, null)
    window_focused = window.id
  }

  if (windows_isNormal(window)) {
    @assert.is(popups_by_id ..@has(window.id), false)
    windows_by_id ..@setNew(window.id, window)

    if (window.tabs != null) {
      window.tabs ..@each(function (tab) {
        tabs_by_id ..@setNew(tab.id, tab)

        if (tab.active) {
          window_focused_tab ..@setNew(window.id, tab)
        }
      })

      @assert.isNot(window_focused_tab ..@get(window.id), null)

    } else {
      window_focused_tab ..@setNew(window.id, null)
    }

    @assert.is(window_focused_tab ..@has(window.id), true)

  } else if (windows_isPopup(window)) {
    @assert.is(windows_by_id ..@has(window.id), false)
    popups_by_id ..@setNew(window.id, window)
  }
})
