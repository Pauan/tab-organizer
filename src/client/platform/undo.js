goog.provide("undo")

goog.require("util.cell")
goog.require("util.log")
goog.require("util.time")
goog.require("platform.port")

goog.scope(function () {
  var cell   = util.cell
    , assert = util.log.assert

  undo.on           = {}
  undo.on.created   = cell.value(undefined)
  undo.on.activated = cell.value(undefined)
  undo.on.removed   = cell.value(undefined)

  undo.loaded = cell.dedupe(false)

  var aUndo = null

  var port = platform.port.connect("undo", function (x) {
    aUndo = x
    undo.loaded.set(true)
  })

  undo.create = function (x) {
    // TODO why doesn't this assert that undo is loaded ?
    cell.when(undo.loaded, function () {
      x["id"] = util.time.timestamp()
      port.message({ "type": "create", "value": x })
    })
  }

  // TODO probably replace with undo.all cell
  undo.getAll = function () {
    assert(undo.loaded.get(), "undo")
    return aUndo
  }

  cell.event([port.on.message], function (x) {
    assert(undo.loaded.get(), "undo")
    // TODO
  })
})
