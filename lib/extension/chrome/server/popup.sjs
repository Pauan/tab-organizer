// TODO save popup IDs between sessions ?

@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "lib:util/event" },
  { id: "lib:util/util" },
  { id: "./tabs/async", name: "async" }
])

var popups_id = {}

function addPopup(url, window) {
  var id = @timestamp()

  var popup = {
    __id__: window.id,

    id: id,
    url: url
  }

  popups_id ..@setNew(popup.__id__, popup)

  return popup
}

function setCoordinates(o, info) {
  if (info.top != null) {
    o.top = Math.round(info.top)
  }
  if (info.left != null) {
    o.left = Math.round(info.left)
  }
  if (info.width != null) {
    o.width = Math.round(info.width)
  }
  if (info.height != null) {
    o.height = Math.round(info.height)
  }
}


exports.on = {}
exports.on.closed = @Emitter()


exports.move = function (popup, info) {
  var o = {}
  //o.focused = true // TODO is this a good idea ?
  setCoordinates(o, info)
  @async.windows.move(popup.__id__, o)
}

exports.open = function (info) {
  @assert.ok(info.url != null)

  var o = {}
  o.url = info.url
  o.type = "popup"
  //o.focused = true

  if (info.focused == null) {
    o.focused = true
  } else {
    o.focused = info.focused
  }

  setCoordinates(o, info)

  var window = @async.windows.create(o)
  var popup  = addPopup(o.url, window)
  // TODO test this
  exports.move(popup, info)
  return popup
}

// TODO different module for this, maybe ?
// TODO code duplication
exports.openPanel = function (info) {
  @assert.ok(info.url != null)

  var o = {}
  o.url = info.url
  o.type = "panel"

  if (info.focused == null) {
    o.focused = true
  } else {
    o.focused = info.focused
  }

  var window = @async.windows.create(o)
  var popup  = addPopup(o.url, window)
  return popup
}

exports.focus = function (popup) {
  @async.windows.update(popup.__id__, { focused: true })
}

exports.close = function (popup) {
  @async.windows.remove(popup.__id__)
}

spawn @async.windows.onRemoved ..@each(function (id) {
  var popup = popups_id[id]
  if (popup != null) {
    @assert.is(popup.__id__, id)

    popups_id ..@delete(popup.__id__)

    exports.on.closed ..@emit({
      popup: popup
    })
  }
})
