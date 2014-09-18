@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" },
  { id: "sjs:object" },
  { id: "lib:util/util" },
  { id: "./options" }
])

TweenLite.defaultEase = Power3.easeInOut

var canAnimate = @opt.get("theme.animation")

exports.create = function (o) {
  o.css ..@setNew("clearProps", o.css ..@ownKeys ..@join(","))
  return o
}

function tweener(f, elem, info) {
  @assert.ok(info.css ..@has("clearProps"))

  if (canAnimate.get()) {
    waitfor () {
      f(elem, info.duration / 1000, {
        css: info.css,
        onComplete: function () {
          resume()
        }
      })
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
