@ = require([
  { id: "./util" }
]);

exports.update = function (id, info) {
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

exports.remove = function (id) {
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
};

exports.get = function (id) {
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

exports.create = function (info) {
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
      exports.window.focus(result.windowId)
    }

    return result
  }
};
