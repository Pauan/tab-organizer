goog.provide("optionMaker")

goog.require("util.cell")
goog.require("util.object")
goog.require("util.array")
goog.require("util.log")
goog.require("platform.port")
goog.require("platform.db")
goog.require("migrate")

goog.scope(function () {
  var cell   = util.cell
    , object = util.object
    , port   = platform.port
    , db     = platform.db
    , fail   = util.log.fail
    , array  = util.array

  optionMaker.make = function (exports, sOpt, sPort, defs) {
    var cOpts = {}
      , opts  = {}

    exports.loaded = cell.dedupe(false)

    exports.get = function (s) {
      if (!exports.loaded.get()) {
        throw new Error(sPort + " not loaded")
      }
      return cOpts[s]
    }

    /* TODO
    exports.fromDisk = function (oNew) {
      var l = cell.dedupe(false)
      if (sOpt in oNew) {
        cell.when(exports.loaded, function () {
          object.forEach(oNew[sOpt], function (x, s) {
            var o = cOpts[s]
            if (o == null) {
              // TODO this should probably fail silently or something ?
              throw new Error("invalid option for " + sOpt + ": " + s)
            } else {
              o.set(x)
            }
          })
          l.set(true)
        })
      } else {
        l.set(true)
      }
      return l
    }*/

    cell.when(migrate.loaded, function () {
      db.open(sOpt, function (dOpts) {
        function make(s, x) {
          if (cOpts[s] == null) {
            opts[s] = x
            cOpts[s] = cell.dedupe(x, {
              set: function (self, x) {
                opts[s] = x
                if (x === defs[s]) {
                  dOpts.del(s)
                } else {
                  dOpts.set(s, x)
                }
                port.message(sPort, { "type": "set", "key": s, "value": x })
              }
            })
          }
        }

        object.each(dOpts.getAll(), function (x, s) {
          make(s, x)
        })
        object.each(defs, function (x, s) {
          make(s, x)
        })

        cell.event([port.on.connect(sPort)], function (message) {
          cell.when(exports.loaded, function () {
            message({ "options": opts, "defaults": defs })
          })
        })

        cell.event([port.on.message(sPort)], function (a) {
          cell.when(exports.loaded, function () {
            array.each(a, function (o) {
              if (o["type"] === "set") {
                cOpts[o["key"]].set(o["value"])
              } else if (o["type"] === "reset") {
                object.each(defs, function (x, s) {
                  cOpts[s].set(x)
                })
              } else {
                fail()
              }
            })
          })
        })

        exports.loaded.set(true)
      })
    })
  }
})
