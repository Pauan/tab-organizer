goog.provide("platform.port")

goog.require("util.cell")
goog.require("util.cell.Signal")
goog.require("util.array")
goog.require("util.log")

goog.scope(function () {
  var cell   = util.cell
    , array  = util.array
    , assert = util.log.assert

  var ports    = {}
  var oMessage = {}
  var oConnect = {}
  var oBatch   = {}

  platform.port.on = {}

  /**
   * @param {string} s
   * @return {!util.cell.Signal}
   */
  platform.port.on.message = function (s) {
    if (oMessage[s] == null) {
      oMessage[s] = cell.value(undefined)
    }
    return oMessage[s]
  }

  /**
   * @param {string} s
   * @return {!util.cell.Signal}
   */
  platform.port.on.connect = function (s) {
    if (oConnect[s] == null) {
      oConnect[s] = cell.value(undefined)
    }
    return oConnect[s]
  }

  function message(s, type, value) {
    if (ports[s] != null) {
      array.each(ports[s], function (x) {
        x["postMessage"]({ "type": type, "value": value })
      })
    }
  }

  platform.port.message = function (s, x) {
    if (oBatch[s] == null) {
      oBatch[s] = [x]
      setTimeout(function () {
        message(s, "batch", oBatch[s])
        delete oBatch[s] // TODO check this
      }, 100)
    } else {
      array.push(oBatch[s], x)
    }
  }

  chrome["runtime"]["onConnect"]["addListener"](function (port) {
    var s = port["name"]

    var disconnected = false

    // TODO see if util.array has any helper functions for this
    var a = ports[s]
    if (a == null) {
      a = ports[s] = []
    }
    array.push(a, port)

    port["onDisconnect"]["addListener"](function () {
      disconnected = true

      // TODO util.array function for this
      var i = array.indexOf(a, port)
      if (i !== -1) {
        array.removeAt(a, i)
        if (array.len(a) === 0) {
          delete ports[s]
        }
      }
    })

    port["onMessage"]["addListener"](function (o) {
      var f = oMessage[s]
      if (f != null) {
        //assert(o["type"] === "batch")
        //f.set(o["value"])
        f.set([o])
      }
    })

    if (oConnect[s] != null) {
      oConnect[s].set(function (x) {
        if (!disconnected) {
          port["postMessage"]({ "type": "init", "value": x })
        }
      })
    }
  })
})
