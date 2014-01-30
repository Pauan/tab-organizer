goog.provide("groups")

goog.require("util.cell")
goog.require("platform.port")
goog.require("goog.object")

goog.scope(function () {
  var cell   = util.cell
    , object = goog.object
    , port   = platform.port

  var oGroups = {}

  groups.add = function (s) {
    var o = oGroups[s]
    if (o == null) {
      o = oGroups[s] = {}
    }
    if (o.tabs == null) {
      o.tabs = 1
      port.batch("groups", { type: "added", value: s })
    } else {
      ++o.tabs
    }
  }

  groups.remove = function (s) {
    var o = oGroups[s]
    console.assert(o != null)
    console.assert(typeof o.tabs === "number")
    --o.tabs
    if (o.tabs === 0) {
      delete o.tabs
      delete oGroups[s]
      port.batch("groups", { type: "removed", value: s })
    }
  }

  cell.event([port.on.connect("groups")], function (message) {
    // TODO a little inefficient
    var r = []
    object.forEach(oGroups, function (_, s) {
      r.push(s)
    })
    message({ type: "all", value: r })
  })
})