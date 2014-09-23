@ = require([
  { id: "sjs:sequence" },
  { id: "./util" },
  { id: "./event" }
])

exports.Observer = function (value) {
  var self = @Emitter()

  // TODO make this into a module function ?
  self.get = function () {
    return value
  }

  // TODO make this into a module function ?
  self.set = function (value_new) {
    if (value !== value_new) {
      value = value_new
      self ..@emit(value)
    }
  }

  // TODO make this into a module function ?
  self.modify = function (f) {
    var value_old = self.get()
    var value_new = f(value)
    if (value_old === self.get()) {
      return self.set(value_new)
    } else {
      throw new Error("value changed during modify")
    }
  }

  return self
}

function call(f, array) {
  return f.apply(null, array ..@map(function (obs) {
    return obs.get()
  }))
}

exports.observe = function (array, f) {
  call(f, array)

  // TODO is this use of each.par correct ?
  array ..@each.par(function (obs) {
    // TODO use each.track ?
    obs ..@each(function () {
      call(f, array)
    })
  })
}
