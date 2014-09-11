@ = require([
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

  return self
}

exports.observe = function (obs, f) {
  var obs_new = exports.Observer(f(obs.get()))

  obs ..@listen(function (value) {
    obs_new.set(f(value))
  })

  return obs_new
}
