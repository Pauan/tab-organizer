@ = require([
  { id: "sjs:sequence" },
  { id: "./util" },
  { id: "./event" }
])

exports.Observer = function (value) {
  var self = @Emitter()

  self.get = function () {
    return value
  }

  self.set = function (value_new) {
    if (value !== value_new) {
      value = value_new
      // TODO should probably change this to be emit ?
      self ..@emitSync(value)
    }
  }

  // TODO make this into a module function ?
  self.modify = function (f) {
    waitfor {
      return self.set(f(self.get()))
    // TODO test this
    // TODO I don't like this way of handling concurrency, look at sjs:observable
    } or {
      throw new Error("util.observe: modify function must not suspend")
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
  var obs_new = exports.Observer(call(f, array))

  array ..@each(function (obs) {
    obs ..@listen(function () {
      obs_new.set(call(f, array))
    })
  })

  return obs_new
}
