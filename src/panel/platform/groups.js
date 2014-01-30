goog.provide("groups")

goog.require("util.cell")
goog.require("util.array")
goog.require("util.log")
goog.require("platform.port")

goog.scope(function () {
  var cell   = util.cell
    , array  = util.array
    , fail   = util.log.fail
    , assert = util.log.assert

  var oGroups = null

  groups.on = cell.value(undefined)

  groups.loaded = cell.dedupe(false)

  var port = platform.port.connect("groups", function (x) {
    oGroups = x
    groups.loaded.set(true)
  })

  cell.event([port.on.message], function (x) {
    array.each(x, function (o) {
      var type = o["type"]
        , x    = o["value"]
      if (type === "added") {
        assert(array.indexOf(oGroups, x) === -1)
        array.push(oGroups, x)
      } else if (type === "removed") {
        var i = array.indexOf(oGroups, x)
        assert(i !== -1)
        array.removeAt(oGroups, i)
      } else {
        fail()
      }
    })
    groups.on.set(x)
  })

  groups.getAll = function () {
    assert(groups.loaded.get(), "groups")
    return oGroups
  }
})
