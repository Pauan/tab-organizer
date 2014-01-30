define("animate", function (require, exports) {
  "use strict";

  TweenLite.defaultEase = Power3.easeInOut

  function Wrapper(x) {
    this.value = x
  }

  var opt = require("opt")

  exports.object = function (o) {
    var r = []
    for (var s in o) {
      if ({}.hasOwnProperty.call(o, s)) {
        r.push(s)
      }
    }
    o.clearProps = r.join(",")
    return new Wrapper(o)
  }

  exports.from = function (e, i, css, f) {
    if (!(css instanceof Wrapper)) {
      throw new Error()
    }
    if (opt.get("theme.animation").get()) {
      TweenLite.from(e.dom(), i, { /*immediateRender: true, */css: css.value, onComplete: f })
    } else if (f != null) {
      f()
    }
  }

  exports.to = function (e, i, css, f) {
    if (!(css instanceof Wrapper)) {
      throw new Error()
    }
    if (opt.get("theme.animation").get()) {
      TweenLite.to(e.dom(), i, { /*immediateRender: true, */css: css.value, onComplete: f })
    } else if (f != null) {
      f()
    }
  }
})
