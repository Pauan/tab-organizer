/**
 * Functions for dealing with Chrome's asynchronousness
 */
@ = require([
  { id: "../../util" }
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

exports.windows = {}

exports.windows.create = function (info) {
  waitfor (var result) {
    chrome.windows.create(info, function (window) {
      @checkError()
      resume(window)
    })
  } retract {
    throw new Error("extension.chrome.tabs: cannot retract when creating new window")
  }

  return result
}

exports.windows.get = function (id) {
  waitfor (var result) {
    chrome.windows.get(id, function (window) {
      @checkError()
      resume(window)
    })
  // TODO this probably isn't necessary
  } retract {
    throw new Error("extension.chrome.tabs: cannot retract when getting a window")
  }

  return result
}

exports.windows.update = function (id, info) {
  waitfor () {
    chrome.windows.update(id, info, function () {
      @checkError()
      resume()
    })
  } retract {
    throw new Error("extension.chrome.tabs: cannot retract when updating a window")
  }
}

exports.windows.remove = function (id) {
  waitfor () {
    chrome.windows.remove(id, function () {
      @checkError()
      resume()
    })
  } retract {
    throw new Error("extension.chrome.tabs: cannot retract when closing a window")
  }
}

exports.windows.move = function (id, info) {
  var state = exports.windows.get(id)

  // TODO test this
  if (state.state === "maximized" || state.state === "normal") {
    var o = {
      top:    info.top,
      left:   info.left,
      width:  info.width,
      height: info.height,
      state:  "normal"
    }
    exports.windows.update(id, o)
    // TODO needed because Chrome is retarded
    hold(100)
    exports.windows.update(id, o)
  }
}

exports.windows.maximize = function (id) {
  var state = exports.windows.get(id)

  // TODO test this
  // TODO is this a good idea ?
  if (state.state === "normal") {
    // It's super dumb that Chrome doesn't let you set both
    // state: "maximized" and focused: false at the same time
    exports.windows.update(id, { state: "maximized"/*, focused: false*/ })
  }
}

exports.windows.unmaximize = function (id) {
  var state = exports.windows.get(id)

  // TODO test this
  // TODO is this a good idea ?
  if (state.state === "maximized") {
    // It's super dumb that Chrome doesn't let you set both
    // state: "maximized" and focused: false at the same time
    exports.windows.update(id, { state: "normal"/*, focused: false*/ })
  }
}


exports.tabs = {}

exports.tabs.create = function (info) {
  waitfor (var result) {
    chrome.tabs.create(info, function (info) {
      @checkError()

      // Chrome doesn't focus the window when focusing the tab,
      // so we have to do it manually in here
      if (info.active) {
        chrome.windows.update(info.windowId, { focused: true })
      }

      resume(info)
    })
  // TODO test this
  } retract {
    throw new Error("extension.chrome.tabs: cannot retract when creating a new tab")
  }

  return result
}
