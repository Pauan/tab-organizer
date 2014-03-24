goog.provide("titles")

goog.require("util.cell")
goog.require("platform.db")

goog.scope(function () {
	var cell = util.cell
	  , db   = platform.db

	titles.loaded = cell.dedupe(false)

	cell.when(db.loaded, function () {
		// TODO it should import window.titles
		var aNames = db.raw("window.titles")
		aNames.setNew([])

		titles.get = function () {
			return aNames.get()
		}

		titles.set = function (x) {
			aNames.set(x)
		}

		titles.loaded.set(true)
	})
})
