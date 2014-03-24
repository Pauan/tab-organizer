goog.provide("undo")

goog.require("util.cell")
goog.require("util.log")
goog.require("platform.db")
goog.require("platform.port")

goog.scope(function () {
	var cell = util.cell
	  , log  = util.log.log
	  , db   = platform.db

	undo.loaded = cell.dedupe(false)

	cell.when(db.loaded, function () {
		// TODO it should import undo
		var aUndo = db.raw("undo")
		aUndo.setNew([])

		cell.event([platform.port.on.connect("undo")], function (port) {
      log("UNDO", aUndo.get())
      port.message(aUndo.get())
    })

    cell.event([platform.port.on.message("undo")], function (a) {
		})

		undo.loaded.set(true)
	})
})