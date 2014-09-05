/**
 * This module handles linking Chrome tabs to Tab Organizer tabs
 */
@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:object" },
  { id: "../util/util" }
])


// Backend (Chrome) to frontend (Tab Organizer)
var back_front_tabs    = {}
var back_front_windows = {}

// Frontend (Tab Organizer) to backend (Chrome)
var front_back_tabs    = {}
var front_back_windows = {}

// Keeps track of which Tab Organizer window each Tab Organizer tab is in
var tab_to_window = {}


exports.tabs = {}

exports.tabs.getWindow = function (front) {
  return tab_to_window ..@get(front.id)
}

exports.tabs.setWindow = function (front, window) {
  tab_to_window[front.id] = window
}

exports.tabs.create = function (front, back) {
  @assert.ok(front.id != null)
  @assert.ok(back.id != null)

  back_front_tabs ..@setNew(back.id, front)
  front_back_tabs ..@setNew(front.id, back)
}

exports.tabs.remove = function (front, back) {
  @assert.ok(front.id != null)
  @assert.ok(back.id != null)

  @assert.is(back_front_tabs ..@get(back.id), front)
  @assert.is(front_back_tabs ..@get(front.id), back)

  back_front_tabs ..@delete(back.id)
  front_back_tabs ..@delete(front.id)
}

exports.tabs.moveId = function (oldId, newId) {
  @assert.isNot(oldId, newId)

  var old = back_front_tabs ..@get(oldId)

  console.log("REPLACING", old, newId)
  back_front_tabs ..@delete(oldId)
  back_front_tabs ..@setNew(newId, old)
}

exports.tabs.fromBack = function (back) {
  @assert.ok(back.id != null)
  return back_front_tabs ..@get(back.id)
}


exports.windows = {}

// TODO code duplication
exports.windows.create = function (front, back) {
  @assert.ok(front.id != null)
  @assert.ok(back.id != null)

  back_front_windows ..@setNew(back.id, front)
  front_back_windows ..@setNew(front.id, back)
}

// TODO code duplication
exports.windows.remove = function (front, back) {
  @assert.ok(front.id != null)
  @assert.ok(back.id != null)

  @assert.is(back_front_windows ..@get(back.id), front)
  @assert.is(front_back_windows ..@get(front.id), back)

  back_front_windows ..@delete(back.id)
  front_back_windows ..@delete(front.id)
}

// TODO code duplication
exports.windows.fromBack = function (back) {
  @assert.ok(back.id != null)
  return back_front_windows ..@get(back.id)
}
