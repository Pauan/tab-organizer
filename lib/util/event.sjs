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
  // TODO use each.par instead ?
  emitter ..@each(function (f) {
    // TODO should the spawn be in here instead ?
    spawn f(value)
  })
}

// TODO could use a better name
exports.emitBlock = function (emitter, value) {
  emitter ..@each(function (f) {
    f(value)
  })
}

// TODO it seems that this can be split into two functions: one to do the emit, and another to check if it suspends or not
exports.emitSync = function (emitter, value) {
  emitter ..@each(function (f) {
    waitfor {
      f(value)
    } or {
      throw new Error("event/emitSync: listener is not allowed to suspend")
    }
  })
}
