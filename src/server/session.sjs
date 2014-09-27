/**
 * This stuff handles persisting tab IDs between sessions
 *
 * This module handles tab persistence in the following way:
 *
 *   1. Save an array of windows
 *   2. Each window has an id and array of tabs
 *   3. Each tab has an id and a url
 *   4. When Chrome starts, compare the Chrome windows to the saved windows
 *   5. To determine if a saved window matches a Chrome window, check
 *      that all the tabs in the saved window match the tab in the Chrome window,
 *      in order
 *   6. To determine if a saved tab matches a Chrome tab, compare their URLs
 *   7. It's okay if either window runs out of tabs before finishing the comparison:
 *      as long as at least one tab matched then it's counted as a success
 */
@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" },
  { id: "sjs:object" },
  { id: "lib:util/event" },
  { id: "lib:util/util" },
  { id: "lib:extension/server" },
  { id: "./migrate", name: "migrate" }
])


var saved_windows = @migrate.db.get("session.windows.array", [])

var windows_id = {}
var tabs_id    = {}


function save() {
  @migrate.db.set("session.windows.array", saved_windows)
}

function save_delay() {
  // 10 seconds, so that when Chrome exits,
  // it doesn't clobber the user's data
  return @migrate.db.delay("session.windows.array", 10000, function () {
    return save()
  })
}


function tab_matches(tab_old, tab_new) {
  return tab_old.url === tab_new.url
}

function window_matches(window_old, window_new) {
  var tabs_old = window_old.tabs
  var tabs_new = window_new.tabs

  @assert.ok(tabs_old.length > 0)
  @assert.ok(tabs_new.length > 0)

  // Check that all the old tabs match with the new tabs
  return @zip(tabs_old, tabs_new) ..@all(function ([tab_old, tab_new]) {
    return tab_matches(tab_old, tab_new)
  })
}

function merge_new_window(window_old, window_new) {
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
      exports.tabs.init(tab_old.id, window, tab_new)

    // Add new tab
    } else {
      // TODO allow for importers to choose the ID function ?
      var id = @timestamp()
      exports.tabs.init(id, window, tab_new)
    }
  })

  console.info("session: merged #{tabs_new.length} tabs into window #{window_old.id}")
}

function create_new_window(window_new) {
  // TODO allow for importers to choose the ID function ?
  var id = @timestamp()

  var window = exports.windows.init(id, window_new)

  // TODO code duplication
  var tabs_new = window_new.tabs
  @assert.ok(tabs_new.length > 0)

  tabs_new ..@each(function (tab_new) {
    // TODO allow for importers to choose the ID function ?
    var id = @timestamp()
    exports.tabs.init(id, window, tab_new)
  })

  console.info("session: created new window #{window.id} with #{window.tabs.length} tabs")
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

  array_new ..@indexed ..@each(function ([i, window_new]) {
    if (i < array_old.length) {
      var window_old = array_old[i]
      // New window matches the old window
      if (window_matches(window_old, window_new)) {
        merge_new_window(window_old, window_new)
      } else {
        create_new_window(window_new)
      }
    } else {
      create_new_window(window_new)
    }
  })

  // TODO this probably isn't necessary, but I like it just in case
  save()
}


exports.windows = {}
exports.tabs = {}

exports.tabs.events = @Emitter()

exports.windows.get = function (id) {
  return windows_id ..@get(id)
}

exports.tabs.get = function (id) {
  return tabs_id ..@get(id)
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

exports.tabs.init = function (id, window, info) {
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


function windows_open(event) {
  @assert.is(event.type, "windows.open")
  @assert.is(event.after.window.tabs.length, 0)
  var id = @timestamp()
  exports.windows.init(id, event.after.window)
}

function windows_close(event) {
  @assert.is(event.type, "windows.close")

  var window = windows_id ..@get(event.before.window.id)

  windows_id ..@delete(event.before.window.id)
  saved_windows ..@remove(window)

  save_delay()
}

function tabs_open(event) {
  @assert.is(event.type, "tabs.open")
  var window = windows_id ..@get(event.after.window.id)
  var id = @timestamp()
  exports.tabs.init(id, window, event.after.tab)
}

function tabs_close(event) {
  @assert.is(event.type, "tabs.close")

  var window  = windows_id ..@get(event.before.window.id)
  var tab     = tabs_id ..@get(event.before.tab.id)
  var closing = event.before.window.closing // TODO probably not compatible with Jetpack

  // TODO isBoolean check
  @assert.ok(closing === true || closing === false)

  tabs_id ..@delete(event.before.tab.id)
  // TODO code duplication with detach_tab
  window.tabs ..@remove(tab)

  // TODO test whether this triggers or not when closing Chrome
  if (closing) {
    save_delay()
  } else {
    save()
  }
}

function tabs_update(event) {
  @assert.is(event.type, "tabs.update")
  var tab = tabs_id ..@get(event.after.tab.id)
  update_tab(tab, event.after.tab)
}

function tabs_replace(event) {
  @assert.is(event.type, "tabs.replace")
  var tab = tabs_id ..@get(event.before.tab.id)
  tabs_id ..@delete(event.before.tab.id)
  tabs_id ..@setNew(event.after.tab.id, tab)
}

function tabs_move(event) {
  @assert.is(event.type, "tabs.move")
  @assert.ok(event.before || event.after)

  if (event.before) {
    var window = windows_id ..@get(event.before.window.id)
    var tab = tabs_id ..@get(event.before.tab.id)
    detach_tab(tab, window, event.before.tab.index)
  }

  if (event.after) {
    var window = windows_id ..@get(event.after.window.id)
    // TODO assert that it's the same tab in both before and after
    var tab = tabs_id ..@get(event.after.tab.id)
    attach_tab(tab, window, event.after.tab.index)
  }

  save()
}


exports.init(@windows.getCurrent())

spawn @tabs.events ..@each(function (event) {
  if (event.type === "windows.open") {
    windows_open(event)
  } else if (event.type === "windows.close") {
    windows_close(event)
  } else if (event.type === "tabs.open") {
    tabs_open(event)
  } else if (event.type === "tabs.update") {
    tabs_update(event)
  } else if (event.type === "tabs.move") {
    tabs_move(event)
  } else if (event.type === "tabs.replace") {
    console.log(event.type)
    tabs_replace(event)
  } else if (event.type === "tabs.close") {
    tabs_close(event)
  }

  exports.tabs.events ..@emit(event)
})

console.info("session: finished")
