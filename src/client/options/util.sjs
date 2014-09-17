@ = require([
  { id: "sjs:object" },
  { id: "lib:util/util" },
  { id: "../options" }
])


exports.opt = function (s) {
  return {
    observer: @opt.get(s),
    // TODO
    "default": @opt.getDefault(s)
  }
}

exports.toNum = function (x) {
  return +x
}

// TODO lib:util/util function for this
exports.copy = function (to, from, s) {
  to ..@setNew(s, from ..@get(s))
}
