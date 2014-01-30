goog.provide("platform.button")

goog.scope(function () {
  var button = chrome["browserAction"]

  platform.button.setURL = function (s) {
    button["setPopup"]({ "popup": s })
  }

  platform.button.setTitle = function (s) {
    button["setTitle"]({ "title": s })
  }

  platform.button.setIconURL = function (s) {
    button["setIcon"]({ "path": s })
  }
})