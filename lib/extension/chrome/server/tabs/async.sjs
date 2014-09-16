/**
 * Functions for dealing with Chrome's asynchronousness
 */
@ = require([
  { id: "sjs:object" },
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

exports.windows.getAll = function (info) {
  // This is necessary because sometimes Chrome will give incorrect results for
  // chrome.windows.getAll if you call it before the window.onload event
  // TODO perhaps this was only true in old versions, and I can remove this now?
  @waitUntilLoaded()

  // TODO what about retraction?
  waitfor (var err, result) {
    chrome.windows.getAll(info, function (windows) {
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

exports.windows.create = function (info) {
  waitfor (var err, result) {
    chrome.windows.create(info, function (window) {
      var err = @checkError()
      if (err) {
        resume(err)
      } else {
        resume(null, window)
      }
    })
  } retract {
    throw new Error("extension.chrome.tabs: cannot retract when creating new window")
  }

  if (err) {
    throw err
  } else {
    return result
  }
}

exports.windows.get = function (id) {
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

exports.windows.update = function (id, info) {
  waitfor (var err) {
    chrome.windows.update(id, info, function () {
      var err = @checkError()
      if (err) {
        resume(err)
      } else {
        resume(null)
      }
    })
  } retract {
    throw new Error("extension.chrome.tabs: cannot retract when updating a window")
  }

  if (err) {
    throw err
  }
}

exports.windows.remove = function (id) {
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
    throw new Error("extension.chrome.tabs: cannot retract when closing a window")
  }

  if (err) {
    throw err
  }
}

exports.windows.move = function (id, info) {
  var state = exports.windows.get(id)

  // TODO test this
  if (state.state === "normal" || state.state === "maximized") {
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
  if (state.state === "normal") {
    // This is needed because Chrome is retarded
    exports.windows.update(id, { state: "normal" })
    // It's super dumb that Chrome doesn't let you set both
    // state: "maximized" and focused: false at the same time
    exports.windows.update(id, { state: "maximized"/*, focused: false*/ })
  }
}

exports.windows.unmaximize = function (id) {
  var state = exports.windows.get(id)

  // TODO test this
  if (state.state === "maximized") {
    // TODO do we need to set its state to maximized first, like with exports.windows.maximize?
    // It's super dumb that Chrome doesn't let you set both
    // state: "maximized" and focused: false at the same time
    exports.windows.update(id, { state: "normal"/*, focused: false*/ })
  }
}


exports.tabs = {}

exports.tabs.create = function (info) {
  waitfor (var err, result) {
    chrome.tabs.create(info, function (info) {
      var err = @checkError()
      if (err) {
        resume(err)
      } else {
        // Chrome doesn't focus the window when focusing the tab,
        // so we have to do it manually in here
        if (info.active) {
          // TODO pass a callback and use checkError?
          chrome.windows.update(info.windowId, { focused: true })
        }

        resume(null, info)
      }
    })
  // TODO test this
  } retract {
    throw new Error("extension.chrome.tabs: cannot retract when creating a new tab")
  }

  if (err) {
    throw err
  } else {
    return result
  }
}
