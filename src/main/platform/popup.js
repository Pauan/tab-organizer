goog.provide("platform.popup")

goog.scope(function () {
  /**
   * @constructor
   */
  function Popup(x) {
    this.id = x["id"]
  }

  var windows = chrome["windows"]

  platform.popup.create = function (url, left, top, width, height, f) {
    windows["create"]({ "url":     url
                      , "type":    "popup"
                      , "top":     top
                      , "left":    left
                      , "width":   width
                      , "height":  height
                      , "focused": true }, function (o) {
                        var p = new Popup(o)
                        platform.popup.move(p, left, top, width, height)
                        f(p)
                      })
  }

  platform.popup.move = function (x, left, top, width, height) {
    windows["update"](x.id, { "top":     top
                            , "left":    left
                            , "width":   width
                            , "height":  height
                            , "state":   "normal"
                            , "focused": true })
  }

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