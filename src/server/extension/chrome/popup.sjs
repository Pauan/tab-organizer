// TODO save popup IDs between sessions ?

@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "../../util/event" },
  { id: "../../util/util" }
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
  o.state = "normal"
  //o.focused = true // TODO is this a good idea ?

  setCoordinates(o, info)

  waitfor () {
    chrome.windows.update(popup.__id__, o, function () {
      resume()
    })
  } retract {
    throw new Error("extension.chrome.popup: cannot retract when moving popup")
  }
}

exports.open = function (info) {
  @assert.ok(info.url != null)

  var o = {}
  o.url = info.url
  o.type = "popup"
  //o.focused = true

  setCoordinates(o, info)

  waitfor (var result) {
    chrome.windows.create(o, function (o) {
      var popup = addPopup(o.url, o)
      // TODO test this
      exports.move(popup, info)
      resume(popup)
    })
  } retract {
    throw new Error("extension.chrome.popup: cannot retract when opening popup")
  }

  return result
}

/*exports.focus = function (popup) {
  waitfor () {
    chrome.windows.update(popup.__id__, { focused: true }, function () {
      resume()
    })
  } retract {
    throw new Error("extension.chrome.popup: cannot retract when focusing popup")
  }
}*/

exports.close = function (popup) {
  waitfor () {
    chrome.windows.remove(popup.__id__, function () {
      resume()
    })
  } retract {
    throw new Error("extension.chrome.popup: cannot retract when closing popup")
  }
}

chrome.windows.onRemoved.addListener(function (id) {
  var popup = popups_id[id]
  if (popup != null) {
    @assert.is(popup.__id__, id)

    popups_id ..@delete(popup.__id__)

    exports.on.closed ..@emit({
      popup: popup
    })
  }
})
