goog.provide("optionMaker")
goog.provide("cache")
goog.provide("opt")

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
    , log    = util.log.log
    , fail   = util.log.fail
    , assert = util.log.assert
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

    exports.fromDisk = function (oNew) {
      var l = cell.dedupe(false)
      if (sOpt in oNew) {
        cell.when(exports.loaded, function () {
          var o = oNew[sOpt]
          // TODO should this use this behavior, or the commented out code below ...?
          object.each(o, function (x, s) {
            // TODO this should probably fail silently or something ?
            assert(s in cOpts)
            cOpts[s].set(x)
          })
          /*object.each(cOpts, function (x, s) {
            if (s in o) {
              x.set(o[s])
            } else {
              x.set(defs[s])
            }
          })*/
          l.set(true)
        })
      } else {
        l.set(true)
      }
      return l
    }

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

        cell.event([port.on.connect(sPort)], function (port) {
          cell.when(exports.loaded, function () {
            port.message({ "options": opts, "defaults": defs })
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


optionMaker.make(cache, "options.cache", "cache", {
  "popup.scroll"             : 0,
  "search.last"              : "",

  "screen.available.checked" : false,
  "screen.available.left"    : 0,
  "screen.available.top"     : 0,
  "screen.available.width"   : screen["width"], // TODO ew
  "screen.available.height"  : screen["height"] // TODO ew
})


optionMaker.make(opt, "options.user", "options", {
  "size.sidebar"              : 300,
  "size.sidebar.position"     : "left",

  "size.popup.left"           : 0.5,
  "size.popup.top"            : 0.5,
  "size.popup.width"          : 920,
  "size.popup.height"         : 496,

  "size.bubble.width"         : 300,
  "size.bubble.height"        : 600,

  "popup.type"                : "bubble",

  "popup.hotkey.ctrl"         : true,
  "popup.hotkey.shift"        : true,
  "popup.hotkey.alt"          : false,
  "popup.hotkey.letter"       : "E",

  "popup.close.escape"        : false,
  "popup.switch.action"       : "minimize",
  "popup.close.when"          : "switch-tab", // "manual",

  "group.sort.type"           : "window",
  "groups.layout"             : "vertical",
  "groups.layout.grid.column" : 3,
  "groups.layout.grid.row"    : 2,

  "tabs.close.location"       : "right",
  "tabs.close.display"        : "hover",
  "tabs.close.duplicates"     : false,
  "tabs.click.type"           : "focus",

  "theme.animation"           : true,
  "theme.color"               : "blue",

  "usage-tracking"            : true
})
