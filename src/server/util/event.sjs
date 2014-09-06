@ = require([
  { id: "sjs:sequence" },
  { id: "./util" }
])

exports.Emitter = function () {
  return []
}

exports.listen = function (emitter, listener) {
  emitter ..@pushNew(listener)
}

exports.emit = function (emitter, value) {
  emitter ..@each(function (f) {
    f(value)
  })
}

exports.emitSync = function (emitter, value) {
  emitter ..@each(function (f) {
    waitfor {
      f(value)
    } or {
      throw new Error("event/emitSync: listener is not allowed to suspend")
    }
  })
}
