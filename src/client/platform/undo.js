goog.provide("undo")

goog.require("util.cell")
goog.require("platform.port")

goog.scope(function () {
  var cell = util.cell

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

	undo.getAll = function () {
		assert(undo.loaded.get(), "undo")
		return aUndo
	}

  cell.event([port.on.message], function (x) {
    assert(undo.loaded.get(), "undo")

  })
})
