@ = require([
  { id: "sjs:assert", name: "assert" }
])

function isRGB(x) {
  return x >= 0 && x <= 255
}

exports.on = {};
exports.on.click = {};

exports.init = function (push) {
  // TODO what about the "tab" argument ?
  chrome.browserAction.onClicked.addListener(function () {
    push({ type: exports.on.click });
  });
};


exports.setURL = function (s) {
  if (s === null) {
    s = "";
  }
  // TODO check if this has a callback or not
  chrome.browserAction.setPopup({ popup: s });
}

exports.setTooltip = function (s) {
  if (s === null) {
    s = "";
  }
  // TODO check if this has a callback or not
  chrome.browserAction.setTitle({ title: s })
}

// TODO support for a dictionary of icon sizes
exports.setIconURL = function (s) {
  if (s === null) {
    s = "";
  }

  waitfor (var err) {
    chrome.browserAction.setIcon({ path: s }, function () {
      var err = @checkError()
      if (err) {
        resume(err)
      } else {
        resume(null)
      }
    })
  } retract {
    throw new Error("extension.chrome.button: cannot retract when setting icon URL")
  }

  if (err) {
    throw err
  }
}

exports.setText = function (s) {
  if (s === null) {
    s = "";
  }
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
