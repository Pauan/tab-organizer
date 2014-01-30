define("search", function (require, exports) {
  "use strict";

  var ui     = require("lib/util/ui")
    , cell   = require("lib/util/cell")
    , cache  = require("cache")
    , parser = require("parser")

  /*function reDomain(sQ, sU) {
    sU = sU || ""
    var r = new RegExp("^https?:\\/\\/(?:www\\.)?" + reQuote(sQ) + sU)
    return function (x) {
      return r.test(x._data.url)
    }
  }*/

  var searchStyle = ui.style(function (e) {
    e.styles(ui.stretch)
    e.set("padding", "1px 2px")
  })

  var errorStyle = ui.style(function (e) {
    e.set("background-color", ui.hsl(0, 100, 60, 0.5))
  })

  function make(oInfo) {
    return ui.search(function (e) {
      e.styles(searchStyle)
      e.autofocus(true)
      /*e.shadow(function (t) {
        t.inset(true)
        t.left("1px")
        t.top("1px")
        t.blur("3px")
        t.color(color.hsl(0, 0, 96))
      })*/
      /*e.outline(function (t) {
        t.style("auto")
        t.size("3px")
        t.color(color.hsl(211, 100, 65)) // TODO code duplication with "common-ui" module
      })*/

      e.bind([oInfo], function (x) {
        e.value.set(x)
      })
      e.event([e.value], function (x) {
        oInfo.set(x)
      })
    })
  }

  var cached, search

  // TODO move into a different module
  // TODO return a loaded thingy which is checked in "panel"
  exports.initialize = function (e) {
    var value = cache.get("search.last")
    var eSearch = make(value)

    if (search == null) {
      search = cell.bind([value], function (s) {
        try {
          cached = parser.parse(s)
          eSearch.title("")
          eSearch.styleWhen(errorStyle, false)
        } catch (e) {
          if (cached == null) {
            cached = function () {
              return true
            }
          }
          eSearch.title(e.message)
          eSearch.styleWhen(errorStyle, true)
        }
        return cached
      })
    }

    eSearch.move(e)
  }

  // TODO a bit hacky
  exports.get = function () {
    return search
  }
})
