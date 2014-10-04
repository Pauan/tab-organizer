@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" },
  { id: "sjs:object" },
  { id: "lib:util/util" },
  { id: "lib:util/dom" },
  { id: "./sync/options" }
])

TweenLite.defaultEase = Power3.easeInOut

var canAnimate = @opt.get("theme.animation")

exports.create = function (o) {
  o.style ..@setNew("clearProps", o.style ..@ownKeys ..@join(","))

  o ..@setNew("animate_start", function (elem) {
    exports.startAt(elem, o)
  })

  o ..@setNew("animate_end", function (elem) {
    exports.endAt(elem, o)
  })

  return o
}

function tweener(f, elem, info) {
  @assert.ok(info.style ..@has("clearProps"))

  if (canAnimate.get()) {
    waitfor () {
      f(@dom(elem), info.duration / 1000, {
        css: info.style,
        onComplete: function () {
          resume()
        }
      })
    } retract {
      throw new Error("cannot retract when animating")
    }
  }
}

exports.startAt = function (elem, info) {
  return tweener(TweenLite.from, elem, info)
}

exports.endAt = function (elem, info) {
  return tweener(TweenLite.to, elem, info)
}

exports.hiddenSlide = function (o) {
  return {
    height: "0px",
    paddingTop: "0px",
    paddingBottom: "0px",
    marginTop: "0px",
    marginBottom: "0px",
    borderTopWidth: "0px",
    borderBottomWidth: "0px",
    opacity: "0"
  } ..@extend(o)
}
