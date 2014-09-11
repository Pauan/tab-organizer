@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "lib:util/event" }
])

function isRGB(x) {
  return x >= 0 && x <= 255
}

exports.on = {}
exports.on.clicked = @Emitter()

chrome.browserAction.onClicked.addListener(function () {
  exports.on.clicked ..@emit()
})


exports.setURL = function (s) {
  // TODO check if this has a callback or not
  chrome.browserAction.setPopup({ popup: s })
}

exports.setTooltip = function (s) {
  // TODO check if this has a callback or not
  chrome.browserAction.setTitle({ title: s })
}

// TODO support for a dictionary of icon sizes
exports.setIconURL = function (s) {
  waitfor () {
    chrome.browserAction.setIcon({ path: s }, function () {
      resume()
    })
  } retract {
    throw new Error("extension.chrome.button: cannot retract when setting icon URL")
  }
}

exports.setText = function (s) {
  // TODO check if this has a callback or not
  chrome.browserAction.setBadgeText({ text: "" + s })
}

exports.setColor = function (r, g, b, a) {
  @assert.ok(isRGB(r))
  @assert.ok(isRGB(g))
  @assert.ok(isRGB(b))
  @assert.ok(a >= 0 && a <= 1)
  // TODO check if this has a callback or not
  chrome.browserAction.setBadgeBackgroundColor({ color: [r, g, b, Math.round(255 * a)] })
}
