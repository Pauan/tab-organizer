@ = require([
  { id: "sjs:sequence", exclude: ["take"] },
  { id: "./util" },
  { id: "./channel" }
])

exports.Emitter = function () {
  var o = @Stream(function (emit) {
    // TODO I would like to use `this` rather than `o`
    var c = exports.on(o)
    try {
      c ..@each(emit)
    } finally {
      exports.off(o, c)
    }
  })

  o.listeners = []

  return o
}

exports.on = function (emitter) {
  var c = @Channel()
  emitter.listeners ..@pushNew(c)
  return c
}

exports.off = function (emitter, c) {
  emitter.listeners ..@remove(c)
}

exports.emit = function (emitter, value) {
  // TODO use each.par instead ?
  emitter.listeners ..@each(function (listener) {
    listener.put(value)
  })
}
