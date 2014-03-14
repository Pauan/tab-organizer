goog.provide("platform.port")

goog.require("util.cell")
goog.require("util.log")

goog.scope(function () {
  var cell   = util.cell
    , assert = util.log.assert
    , fail   = util.log.fail

  platform.port.connect = function (s, f) {
    var self        = {}
    self.on         = {}
    self.on.message = cell.value(undefined)

    var disconnected = false

    var port = chrome["runtime"]["connect"]({ "name": s })
    port["onMessage"]["addListener"](function (o) {
      var type = o["type"]
        , x    = o["value"]
      if (type === "init") {
        f(x)
      } else if (type === "batch") {
        self.on.message.set(x)
      } else {
        fail()
      }
    })

    port["onDisconnect"]["addListener"](function () {
      disconnected = true
    })

    self.message = function (o) {
      assert(!disconnected)
      port["postMessage"](o)
    }

    return self
  }

  platform.port.request = function (s, o, f) {
    chrome["runtime"]["sendMessage"]({ "type": s, "value": o }, function (s) {
      if (f != null) {
        f(s)
      }
    })
  }
})
