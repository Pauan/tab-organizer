/**
 * Functions for dealing with Chrome's asynchronousness
 */
@ = require([
  { id: "sjs:object" },
  { id: "lib:util/event" },
  { id: "lib:util/util" },
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

exports.windows.onRemoved = @Emitter()

var windows_removed_queue = {}

chrome.windows.onRemoved.addListener(function (id) {
  // TODO emitBlock ?
  exports.windows.onRemoved ..@emit(id)

  if (windows_removed_queue ..@has(id)) {
    var queue = windows_removed_queue ..@get(id)
    windows_removed_queue ..@delete(id)
    queue()
  }
})

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
    // TODO use windows.get to return a more accurate state ?
    return result
  }
}

exports.windows.update = function (id, info) {
  // TODO It's super dumb that Chrome doesn't let you set both
  //      state: "maximized" and focused: false at the same time
  /*if (info.focused) {
    windows_update(id, { focused: false })
    hold(1000)
  }*/

  if (info.state !== "normal") {
    // TODO needed because Chrome is retarded
    windows_update(id, { state: "normal" })
  }

  // TODO needed because Chrome is retarded
  if (info.top != null || info.left != null || info.width != null || info.height != null) {
    windows_update(id, info)
    hold(100)
  }

  windows_update(id, info)
}

exports.windows.remove = function (id) {
  waitfor (var err) {
    function callback() {
      var err = @checkError()
      if (err) {
        resume(err)
      } else {
        resume(null)
      }
    }

    // TODO what if it's never removed from the queue ?
    windows_removed_queue ..@setNew(id, callback)
    chrome.windows.remove(id) // TODO use checkError in here too ?
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
  }
}

exports.windows.maximize = function (id) {
  var state = exports.windows.get(id)

  // TODO test this
  if (state.state === "normal") {
    exports.windows.update(id, { state: "maximized"/*, focused: false*/ })
  }
}

exports.windows.unmaximize = function (id) {
  var state = exports.windows.get(id)

  // TODO test this
  if (state.state === "maximized") {
    // TODO do we need to set its state to maximized first, like with exports.windows.maximize?
    exports.windows.update(id, { state: "normal"/*, focused: false*/ })
  }
}


exports.tabs = {}

exports.tabs.create = function (info) {
  waitfor (var err, result) {
    chrome.tabs.create(info, function (tab) {
      var err = @checkError()
      if (err) {
        resume(err)
      } else {
        resume(null, tab)
      }
    })
  // TODO test this
  } retract {
    throw new Error("extension.chrome.tabs: cannot retract when creating a new tab")
  }

  if (err) {
    throw err
  } else {
    // Chrome doesn't focus the window when focusing the tab,
    // so we have to do it manually in here
    // TODO test this
    if (info.active) {
      exports.windows.update(result.windowId, { focused: true })
    }

    return result
  }
}

exports.tabs.update = function (id, info) {
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
    // Chrome doesn't focus the window when focusing the tab,
    // so we have to do it manually in here
    // TODO would be nice to be able to do this in parallel with the tab update...
    // TODO test this
    if (info.active) {
      exports.windows.update(result.windowId, { focused: true })
    }

    // TODO use chrome.tabs.get to return a more accurate state ?
    return result
  }
}

// TODO is tabs.remove callback called before or after tabs.onRemoved ?
exports.tabs.remove = function (id) {
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
    throw new Error("extension.chrome.tabs: cannot retract when removing a tab")
  }

  if (err) {
    throw err
  }
}
