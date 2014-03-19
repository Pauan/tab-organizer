goog.provide("platform.button")

goog.require("util.cell")
goog.require("util.math")

goog.scope(function () {
  var cell = util.cell

  var button = chrome["browserAction"]

  platform.button.on = {}

  // TODO test this
  platform.button.on.clicked = cell.value(undefined, {
    bind: function (self) {
      function click() {
        self.set(undefined)
      }
      button["onClicked"]["addListener"](click)
      return click
    },
    unbind: function (click) {
      button["onClicked"]["removeListener"](click)
    }
  })

  platform.button.setURL = function (s) {
    button["setPopup"]({ "popup": s })
  }

  platform.button.setTitle = function (s) {
    button["setTitle"]({ "title": s })
  }

  platform.button.setIconURL = function (s) {
    button["setIcon"]({ "path": s })
  }

  platform.button.setText = function (s) {
    button["setBadgeText"]({ "text": "" + s })
  }

  platform.button.setColor = function (r, g, b, a) {
    button["setBadgeBackgroundColor"]({ "color": [r, g, b, util.math.round(255 * a)] })
  }
})
