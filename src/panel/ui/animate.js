goog.provide("ui.animate")

goog.require("opt")
goog.require("util.array")
goog.require("util.object")
goog.require("util.log")

goog.scope(function () {
  var assert = util.log.assert
    , object = util.object
    , array  = util.array

  TweenLite["defaultEase"] = Power3["easeInOut"]

  /**
   * @constructor
   */
  function Wrapper(x) {
    this.value = x
  }

  ui.animate.object = function (o) {
    o["clearProps"] = array.join(object.keys(o), ",")
    return new Wrapper(o)
  }

  /**
   * TODO more specific type for the first argument
   * @param {!Object} e
   * @param {number} i
   * @param {!Wrapper} css
   * @param {function():void=} f
   */
  ui.animate.from = function (e, i, css, f) {
    assert(css instanceof Wrapper)

    if (opt.get("theme.animation").get()) {
      TweenLite["from"](e.dom(), i, { /*immediateRender: true, */"css": css.value, "onComplete": f })
    } else if (f != null) {
      f()
    }
  }

  /**
   * TODO more specific type for the first argument
   * @param {!Object} e
   * @param {number} i
   * @param {!Wrapper} css
   * @param {function():void=} f
   */
  ui.animate.to = function (e, i, css, f) {
    assert(css instanceof Wrapper)

    if (opt.get("theme.animation").get()) {
      TweenLite["to"](e.dom(), i, { /*immediateRender: true, */"css": css.value, "onComplete": f })
    } else if (f != null) {
      f()
    }
  }
})
