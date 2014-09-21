/**
 * This stuff handles persisting tab IDs between sessions
 */
@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" },
  { id: "sjs:object" },
  { id: "lib:util/util" },
  { id: "../db", name: "db" }
])


var saved_windows = @db.get("__extension.chrome.tabs.windows__", [])

var windows_id = {}
var tabs_id    = {}


function save() {
  @db.set("__extension.chrome.tabs.windows__", saved_windows)
}

function save_delay() {
  // 10 seconds, so that when Chrome exits,
  // it doesn't clobber the user's data
  return @db.delay("__extension.chrome.tabs.windows__", 10000, function () {
    return save()
  })
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

  // If the new window doesn't have any tabs in it, then it does not match the old window
  } else {
    return false
  }
}

function mergeWindow(window_old, window_new) {
  var window = exports.windows.init(window_old.id, window_new)

  // TODO code duplication
  var tabs_old = window_old.tabs
  var tabs_new = window_new.tabs

  @assert.ok(tabs_old.length > 0)
  @assert.ok(tabs_new.length > 0)

  tabs_new ..@indexed ..@each(function ([i, tab_new]) {
    // Merge with existing tab
    if (i < tabs_old.length) {
      var tab_old = tabs_old[i]
      exports.tabs.init(tab_old.id, tab_new)

    // Add new tab
    } else {
      // TODO allow for importers to choose the ID function ?
      var id = @timestamp()
      exports.tabs.init(id, tab_new)
    }
  })

  return window
}

function update_tab(tab, info) {
  if (info.url !== tab.url) {
    if (info.url === void 0) {
      delete tab.url
    } else {
      tab.url = info.url
    }
    save()
  }
}

function attach_tab(tab, window, index) {
  @assert.ok(index != null)
  window.tabs ..@spliceNew(index, tab)
  @assert.is(window.tabs[index], tab)
}

function detach_tab(tab, window, index) {
  @assert.ok(index != null)
  @assert.is(window.tabs[index], tab)
  window.tabs ..@remove(tab)
}


exports.init = function (array_new) {
  var array_old = saved_windows
  saved_windows = []

  // TODO replace with iterator or something
  var i = 0

  // Merge new windows into old windows
  array_old ..@each { |window_old|
    if (i < array_new.length) {
      var window_new = array_new[i]
      if (window_new.type === "normal") {
        // New window matches the old window
        if (windowMatchesOld(window_old, window_new)) {
          mergeWindow(window_old, window_new)
          console.info("extension.chrome.tabs: merged #{window_new.tabs.length} tabs into window #{window_old.id}")
          ++i
        }
      } else {
        ++i
      }
    } else {
      break
    }
  }

  // New windows
  while (i < array_new.length) {
    var window_new = array_new[i]
    if (window_new.type === "normal") {
      // TODO allow for importers to choose the ID function ?
      var id = @timestamp()

      var window = exports.windows.init(id, window_new)

      // Oddly enough, Chrome windows sometimes don't have a tabs property
      if (window_new.tabs != null) {
        window_new.tabs ..@each(function (tab_new) {
          // TODO allow for importers to choose the ID function ?
          var id = @timestamp()
          exports.tabs.init(id, tab_new)
        })
      }

      console.info("extension.chrome.tabs: created new window #{window.id} with #{window.tabs.length} tabs")
    }
    ++i
  }

  // TODO this probably isn't necessary, but I like it just in case
  save()
}


exports.windows = {}

exports.windows.get = function (id) {
  return windows_id ..@get(id)
}

exports.windows.init = function (id, info) {
  var window = {
    id: id,
    tabs: []
  }

  windows_id ..@setNew(info.id, window)
  saved_windows ..@push(window)

  save()

  return window
}

exports.windows.open = function (id, info) {
  if (info.type === "normal") {
    @assert.ok(info.tabs == null)

    exports.windows.init(id, info)
  }
}

exports.windows.close = function (id) {
  var window = windows_id[id]
  if (window != null) {
    windows_id ..@delete(id)
    saved_windows ..@remove(window)

    save_delay()
  }
}


exports.tabs = {}

exports.tabs.get = function (id) {
  return tabs_id ..@get(id)
}

exports.tabs.init = function (id, info) {
  var window = windows_id ..@get(info.windowId)

  var tab = {
    id: id
  }

  tabs_id ..@setNew(info.id, tab)
  attach_tab(tab, window, info.index)
  update_tab(tab, info)

  // Saves regardless of whether update_tab saves or not
  save()

  return tab
}

exports.tabs.open = function (id, info) {
  // Only add tabs if they are in a window of type "normal"
  var window = windows_id[info.windowId]
  if (window != null) {
    exports.tabs.init(id, info)
  }
}

exports.tabs.close = function (id, info) {
  var tab = tabs_id[id]
  if (tab != null) {
    @assert.ok(info.windowId != null)
    // TODO isBoolean check
    @assert.ok(info.isWindowClosing === true || info.isWindowClosing === false)

    var window = windows_id ..@get(info.windowId)
    tabs_id ..@delete(id)
    // TODO code duplication with detach_tab
    window.tabs ..@remove(tab)

    // TODO test whether this triggers or not when closing Chrome
    if (info.isWindowClosing) {
      save_delay()
    } else {
      save()
    }
  }
}

exports.tabs.update = function (info) {
  var tab = tabs_id[info.id]
  if (tab != null) {
    update_tab(tab, info)
  }
}

exports.tabs.replace = function (id, info) {
  var tab = tabs_id[id]
  if (tab != null) {
    tabs_id ..@delete(id)
    tabs_id ..@setNew(info.id, tab)
  }
}

exports.tabs.focus = function (id, window_id) {}

exports.tabs.attach = function (id, window_id, index) {
  var tab = tabs_id[id]
  if (tab != null) {
    @assert.ok(window_id != null)

    var window = windows_id ..@get(window_id)
    attach_tab(tab, window, index)

    save()
  }
}

exports.tabs.detach = function (id, window_id, index) {
  var tab = tabs_id[id]
  if (tab != null) {
    @assert.ok(window_id != null)

    var window = windows_id ..@get(window_id)
    detach_tab(tab, window, index)

    save()
  }
}

exports.tabs.move = function (id, window_id, from, to) {
  var tab = tabs_id[id]
  if (tab != null) {
    @assert.ok(window_id != null)

    var window = windows_id ..@get(window_id)
    detach_tab(tab, window, from)
    attach_tab(tab, window, to)

    save()
  }
}
