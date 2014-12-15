@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "./util" }
]);

// TODO what if the "load" event never fires?
function waitUntilLoaded() {
  @assert.ok(typeof document.readyState === "string")

  if (document.readyState !== "complete") {
    waitfor () {
      addEventListener("load", resume, true)
    } finally {
      removeEventListener("load", resume, true)
    }
  }
}

exports.get = function (id) {
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
};

exports.update = function (id, info) {
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
    return result
  }
};

exports.remove = function (id) {
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
    throw new Error("extension.chrome.windows: cannot retract when closing a window")
  }

  if (err) {
    throw err
  }
};

exports.getAll = function () {
  // This is necessary because sometimes Chrome will give incorrect results for
  // chrome.windows.getAll if you call it before the window.onload event
  // TODO perhaps this was only true in old versions, and I can remove this now?
  waitUntilLoaded()

  // TODO what about retraction?
  waitfor (var err, result) {
    chrome.windows.getAll({ populate: true }, function (windows) {
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
};

exports.create = function (info) {
  waitfor (var err, result) {
    chrome.windows.create(o, function (window) {
      var err = @checkError()
      if (err) {
        resume(err)
      } else {
        resume(null, window)
      }
    })
  } retract {
    throw new Error("extension.chrome.windows: cannot retract when opening new window")
  }

  if (err) {
    throw err
  } else {
    return result
  }
};
