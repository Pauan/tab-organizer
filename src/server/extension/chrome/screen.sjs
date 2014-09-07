// TODO move these to chrome/tabs
function create() {
  waitfor (var result) {
    chrome.windows.create({ url: "data/empty.html", focused: false, type: "normal" }, function (window) {
      resume(window)
    })
  } retract {
    throw new Error("extension.chrome.screen: cannot retract when creating new window")
  }
}

function maximize(window) {
  waitfor (var result) {
    chrome.windows.update(window.id, { state: "maximized", focused: false }, function (window) {
      resume(window)
    })
  } retract {
    throw new Error("extension.chrome.screen: cannot retract when maximizing a window")
  }

  return result
}

function get(window) {
  waitfor (var result) {
    chrome.windows.get(window.id, function (window) {
      resume(window)
    })
  // TODO this probably isn't necessary
  } retract {
    throw new Error("extension.chrome.screen: cannot retract when getting a window")
  }

  return result
}

function remove(window) {
  waitfor () {
    chrome.windows.remove(window.id, function () {
      resume()
    })
  } retract {
    throw new Error("extension.chrome.screen: cannot retract when closing a window")
  }
}

exports.getMaximumSize = function () {
  var window = create()

  // super hacky, but needed because of Chrome's retardedness
  maximize(window)
  hold(2000) // 250

  maximize(window)
  hold(2000) // 250

  var info = get(window)
  remove(window)

  return {
    left: info.left,
    top: info.top,
    width: info.width,
    height: info.height
  }
}
