/**
 * This stuff handles the active/temporary/transient parts of the tab
 */
@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" },
  { id: "sjs:object" },
  { id: "lib:util/util" },
  { id: "lib:util/event" },
  { id: "./saved", name: "saved" }
])

var windows    = []
var windows_id = {}
var tabs_id    = {}

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

// updateIndexes is unnecessary because windows are always added to the end
function window_attach(window) {
  window.index = windows ..@pushNew(window) - 1
  @assert.is(windows[window.index], window)
}

function window_detach(window) {
  @assert.ok(window.index != null)
  @assert.is(windows[window.index], window)
  windows ..@remove(window)
  updateIndexes(windows, window.index)
}

// Verifies that a tab's focus state is correct
function tab_check_focus(tab) {
  @assert.ok(tab.window != null)

  if (tab.focused) {
    @assert.is(tab.window.focusedTab, tab)
  } else {
    @assert.isNot(tab.window.focusedTab, tab)
  }
}

// Verifies that the tab's state is correct (compared to a Chrome tab)
function tab_check(tab, info) {
  @assert.is(tab.__id__, info.id)
  @assert.isNot(tab.id, info.id) // TODO should probably remove this
  @assert.is(tab.window.__id__, info.windowId)
  @assert.is(tab.focused, info.active)
  @assert.is(tab.index, info.index)

  @assert.ok(tabs_id ..@has(info.id))
  @assert.ok(tabs_id ..@has(tab.__id__))
  @assert.is(tab.closed, false)
  @assert.ok(info.index != null)
  @assert.ok(tab.window != null)
  @assert.is(tab.window.tabs[info.index], tab)

  tab_check_focus(tab)
}

function tab_attach(tab, window, index) {
  @assert.ok(index != null)
  @assert.ok(tab.index == null || tab.index !== index)
  @assert.ok(tab.window == null || tab.window !== window)

  tab.window = window
  tab.index = index
  tab.window.tabs ..@spliceNew(tab.index, tab)

  @assert.ok(tab.index != null)
  @assert.is(tab.window.tabs[tab.index], tab)
  updateIndexes(tab.window.tabs, tab.index + 1)
}

function tab_detach(tab) {
  @assert.ok(tab.index != null)
  @assert.is(tab.window.tabs[tab.index], tab)

  tab.window.tabs ..@remove(tab)

  updateIndexes(tab.window.tabs, tab.index)
}

// It's slightly more efficient to have a move operation rather than using detach + attach
function tab_move(tab, from, to) {
  @assert.ok(from != null)
  @assert.ok(to != null)
  @assert.isNot(from, to)
  @assert.ok(tab.index != null)
  @assert.is(tab.index, from)
  @assert.is(tab.window.tabs[tab.index], tab)

  // same as tab_detach
  tab.window.tabs ..@remove(tab)

  // similar to tab_attach
  tab.index = to
  tab.window.tabs ..@spliceNew(tab.index, tab)

  @assert.is(tab.index, to)
  @assert.is(tab.window.tabs[tab.index], tab)
  updateIndexes(tab.window.tabs, Math.min(from, to + 1))
}

function tab_unfocus(tab) {
  @assert.is(tab.focused, true)
  tab.focused = false

  tab_check_focus(tab)

  exports.tabs.on.unfocus ..@emit({
    tab: tab
  })
}

function tab_focus(tab) {
  var old = tab.window.focusedTab
  tab.window.focusedTab = tab

  // This happens when...
  // A) the tab already exists and is already focused (e.g. on startup)
  // B) the tab is moved to/from a different window
  if (tab.focused) {
    tab_check_focus(tab)

  // This happens when...
  // A) the tab is created and it's not focused yet (e.g. when opening a new tab)
  // B) the tab is unfocused and then becomes focused (e.g. by clicking on it)
  } else {
    tab.focused = true

    tab_check_focus(tab)

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
      tab_unfocus(old)
    }
  }
}

function should_update(tab, info) {
  return tab.url !== info.url ||
         tab.title !== info.title ||
         tab.pinned !== info.pinned
}

function tab_update(tab, info) {
  tab.url = info.url
  tab.favicon = "chrome://favicon/" + info.url
  tab.title = info.title
  tab.pinned = info.pinned
}


exports.init = function (windows) {
  windows ..@each(function (info) {
    if (info.type === "normal") {
      var id = @saved.windows.get(info.id)
      exports.windows.init(id, info)

      // Oddly enough, Chrome windows sometimes don't have a tabs property
      if (info.tabs != null) {
        info.tabs ..@each(function (tab) {
          var id = @saved.tabs.get(tab.id)
          exports.tabs.init(id, tab)
        })
      }
    }
  })
}


/**
 * exports.windows
 */
exports.windows = {}
exports.windows.on = {}
exports.windows.on.open = @Emitter()
exports.windows.on.close = @Emitter()

exports.windows.getCurrent = function () {
  return windows
}

exports.windows.init = function (id, info) {
  @assert.ok(id != null)

  var window = {
    __id__: info.id,

    id: id,
    focusedTab: null,
    tabs: []
  }

  windows_id ..@setNew(window.__id__, window)
  window_attach(window)

  return window
}

exports.windows.open = function (id, info) {
  if (info.type === "normal") {
    @assert.ok(info.tabs == null)

    exports.windows.on.open ..@emit({
      window: exports.windows.init(id, info)
    })
  }
}

exports.windows.close = function (id) {
  var window = windows_id[id]
  if (window != null) {
    @assert.is(window.__id__, id)

    windows_id ..@delete(window.__id__)
    window_detach(window)

    exports.windows.on.close ..@emit({
      window: window
    })
  }
}


/**
 * exports.tabs
 */
exports.tabs = {}
exports.tabs.on = {}
exports.tabs.on.open = @Emitter()
exports.tabs.on.update = @Emitter()
exports.tabs.on.close = @Emitter()
exports.tabs.on.focus = @Emitter()
exports.tabs.on.unfocus = @Emitter()
exports.tabs.on.move = @Emitter()

exports.tabs.init = function (id, info) {
  var window = windows_id ..@get(info.windowId)

  @assert.ok(id != null)
  @assert.is(window.__id__, info.windowId)

  var tab = {
    __id__: info.id,

    id: id,
    focused: info.active,

    detached: false,
    closed: false
  }

  tabs_id ..@setNew(tab.__id__, tab)
  tab_update(tab, info)
  tab_attach(tab, window, info.index)

  if (tab.focused) {
    tab_focus(tab)
  }

  tab_check(tab, info)

  return tab
}

exports.tabs.open = function (id, info) {
  // Checks that the tab belongs to a window with type "normal"
  var window = windows[info.windowId]
  if (window != null) {
    exports.tabs.on.open ..@emit({
      tab: exports.tabs.init(id, info)
    })
  }
}

exports.tabs.update = function (info) {
  var tab = tabs_id[info.id]
  if (tab != null) {
    tab_check(tab, info)

    if (should_update(tab, info)) {
      tab_update(tab, info)

      exports.tabs.on.update ..@emit({
        tab: tab
      })
    }
  }
}

exports.tabs.replace = function (id, info) {
  var tab = tabs_id[id]
  if (tab != null) {
    @assert.ok(tab.__id__ != null)
    @assert.is(tab.__id__, id)
    @assert.isNot(tab.__id__, info.id)
    @assert.is(tab.window.__id__, info.windowId)
    @assert.is(windows_id ..@get(info.windowId), tab.window)

    tabs_id ..@delete(tab.__id__)
    tab.__id__ = info.id
    tabs_id ..@setNew(tab.__id__, tab)

    console.log("PLATFORM: REPLACING", tab, info)

    // TODO a tiny bit inefficient
    exports.tabs.update(info)
  }
}

exports.tabs.attach = function (id, window_id, index) {
  var tab = tabs_id[id]
  if (tab != null) {
    @assert.is(tab.__id__, id)
    var window = windows_id ..@get(window_id)

    @assert.ok(tab.window != null)
    @assert.ok(tab.index != null)

    var old = {
      window: tab.window,
      index: tab.index
    }

    tab_attach(tab, window, index)

    @assert.is(tab.detached, true)
    tab.detached = false

    exports.tabs.on.move ..@emit({
      tab: tab,
      old: old
    })
  }
}

exports.tabs.detach = function (id, window_id, index) {
  var tab = tabs_id[id]
  if (tab != null) {
    @assert.is(tab.__id__, id)
    @assert.ok(tab.window != null)
    @assert.is(tab.window.__id__, window_id)
    @assert.is(tab.index, index)

    tab_detach(tab)

    @assert.is(tab.detached, false)
    tab.detached = true
  }
}

exports.tabs.move = function (id, window_id, from, to) {
  var tab = tabs_id[id]
  if (tab != null) {
    @assert.is(tab.__id__, id)
    @assert.ok(tab.window != null)
    @assert.is(tab.window.__id__, window_id)

    var old = {
      window: tab.window,
      index: tab.index
    }

    tab_move(tab, from, to)

    exports.tabs.on.move ..@emit({
      tab: tab,
      old: old
    })
  }
}

exports.tabs.focus = function (id, window_id) {
  var tab = tabs_id[id]
  if (tab != null) {
    @assert.is(tab.__id__, id)
    @assert.is(tab.window.__id__, window_id)
    tab_focus(tab)
  }
}

exports.tabs.close = function (id, info) {
  var tab = tabs_id[id]
  if (tab != null) {
    @assert.is(tab.__id__, id)

    // TODO isBoolean check
    @assert.ok(info.isWindowClosing === true || info.isWindowClosing === false)

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

    tabs_id ..@delete(tab.__id__)
    tab_detach(tab)

    exports.tabs.on.close ..@emit({
      tab: tab,
      // TODO rename this
      // TODO this probably shouldn't be a part of the public API, because Jetpack may not be able to support it
      isWindowClosing: info.isWindowClosing
    })
  }
}
