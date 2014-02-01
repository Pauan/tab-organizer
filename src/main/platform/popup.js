goog.provide("platform.popup")

goog.require("util.Symbol")
goog.require("util.cell")
goog.require("util.math")
goog.require("util.log")

goog.scope(function () {
  var Symbol = util.Symbol
    , cell   = util.cell
    , math   = util.math
    , assert = util.log.assert

  var _id = Symbol("_id")

  /**
   * @constructor
   */
  function Popup() {
    this.loaded = cell.dedupe(false)
  }

  var windows = chrome["windows"]

  var ids = {}

  platform.popup.on        = {}
  platform.popup.on.closed = cell.value(undefined)

  // TODO use platform.windows.create instead ?
  platform.popup.open = function (url, oSize) {
    var p = new Popup()
    windows["create"]({ "url":     url
                      , "type":    "popup"
                      , "top":     math.round(oSize.top)
                      , "left":    math.round(oSize.left)
                      , "width":   math.round(oSize.width)
                      , "height":  math.round(oSize.height)
                      , "focused": true }, function (o) {
                        p[_id] = o["id"]
                        ids[p[_id]] = p
                        p.loaded.set(true)
                        platform.popup.move(p, oSize)
                      })
    return p
  }

  platform.popup.move = function (p, oSize) {
    cell.when(p.loaded, function () {
      if (p[_id] != null) {
        windows["update"](p[_id], { "top":     math.round(oSize.top)
                                  , "left":    math.round(oSize.left)
                                  , "width":   math.round(oSize.width)
                                  , "height":  math.round(oSize.height)
                                  , "state":   "normal"
                                  , "focused": true })
      }
    })
  }

  platform.popup.close = function (p) {
    cell.when(p.loaded, function () {
      if (p[_id] != null) {
        windows["remove"](p[_id])
      }
    })
  }

  windows["onRemoved"]["addListener"](function (id) {
    var p = ids[id]
    if (p != null) {
      assert(id === p[_id])
      delete ids[id]
      delete p[_id]
      platform.popup.on.closed.set(p)
    }
  })

  platform.popup.getSize = function (f) {
    windows["create"]({ "url": "data/empty.html", "focused": false, "type": "normal" }, function (e) {
      // super hacky, but needed because of Chrome's retardedness
      windows["update"](e["id"], { "state": "maximized" }, function (e) {
        setTimeout(function () {
          windows["update"](e["id"], { "state": "maximized" }, function (e) {
            setTimeout(function () {
              windows["get"](e["id"], function (e) {
                windows["remove"](e["id"], function () {
                  f(e["left"], e["top"], e["width"], e["height"])
                })
              })
            }, 250)
          })
        }, 250)
      })
    })
  }
})
