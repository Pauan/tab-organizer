goog.provide("opt")
goog.provide("cache")

goog.require("util.cell")
goog.require("util.array")
goog.require("util.object")
goog.require("util.log")
goog.require("platform.port")

goog.scope(function () {
  var cell   = util.cell
    , array  = util.array
    , object = util.object
    , assert = util.log.assert
    , fail   = util.log.fail
    , log    = util.log.log

  function make(exports, sPort) {
    var opts = {}
      , defs = null

    exports.loaded = cell.dedupe(false)

    var port = platform.port.connect(sPort, function (x) {
      defs = x["defaults"]
      object.each(x["options"], function (x, s) {
        // TODO closure
        opts[s] = cell.dedupe(x, {
          set: function (self, x) {
            port.message({ "type": "set", "key": s, "value": x })
          }
        })
      })
      exports.loaded.set(true)
    })

    cell.event([port.on.message], function (x) {
      log("option-loader", x)
      array.each(x, function (o) {
        if (o["type"] === "set") {
          opts[o["key"]].set(o["value"]) // TODO maybe double-check this?
        } else {
          fail()
        }
      })
    })

    exports.getDefault = function (s) {
      assert(exports.loaded.get(), sPort)
      return defs[s]
    }

    exports.get = function (s) {
      assert(exports.loaded.get(), sPort)
      return opts[s]
    }

    exports.reset = function () {
      assert(exports.loaded.get(), sPort)
      port.message({ "type": "reset" })
    }
  }

  make(cache, "cache")
  make(opt, "options")
})
