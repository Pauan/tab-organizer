@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" },
  { id: "./util" },
  { id: "./event" }
])


exports.ObservableArray = function (array) {
  var emitter = @Emitter()

  var closed = false

  var self = {}

  self.current = @Stream(function (emit) {
    array ..@indexed ..@each(function ([i, after]) {
      emit({
        type: "add",
        index: i,
        after: after
      })
    })
  })

  // TODO is this buffering correct ?
  self.changes =  @Stream(function (emit) {
    @assert.is(closed, false)

    emitter ..@each { |x|
      if (x.type === "close") {
        break
      } else {
        emit(x)
      }
    }
  }) ..@buffer(Infinity)

  self.close = function () {
    @assert.is(closed, false)

    closed = true

    emitter ..@emit({
      type: "close"
    })
  }

  self.nth_has = function (i) {
    @assert.ok(i >= 0)
    return i < array.length
  }

  self.nth = function (i) {
    @assert.is(self.nth_has(i), true)
    return array[i]
  }

  self.nth_of = function (x) {
    return array.indexOf(x)
  }

  self.nth_add = function (i, after) {
    @assert.is(closed, false)

    @assert.ok(i >= 0)

    var index = self.nth_of(after)
    @assert.is(index, -1)

    // Minor optimization
    if (i === array.length) {
      array.push(after)
    } else {
      array.splice(i, 0, after)
    }

    emitter ..@emit({
      type: "add",
      index: i,
      after: after
    })
  }

  self.nth_modify = function (i, f) {
    @assert.is(closed, false)

    @assert.is(self.nth_has(i), true)

    var before = array[i]
    var after  = f(before)
    @assert.is(array[i], before)

    if (after !== before) {
      array[i] = after

      emitter ..@emit({
        type: "modify",
        index: i,
        before: before,
        after: after
      })
    }
  }

  self.nth_remove = function (i) {
    @assert.is(closed, false)

    @assert.is(self.nth_has(i), true)

    var before = array[i]
    array.splice(i, 1)

    emitter ..@emit({
      type: "remove",
      index: i,
      before: before
    })
  }


  self.add = function (after) {
    self.nth_add(array.length, after)
  }

  self.remove = function (before) {
    var index = self.nth_of(before)
    self.nth_remove(index)
  }

  return self
}

// TODO code duplication with ObservableArray
exports.ObservableHash = function (hash) {
  var emitter = @Emitter()

  var closed = false

  var self = {}

  self.current = @Stream(function (emit) {
    hash ..@eachKeys(function (key, after) {
      emit({
        type: "add",
        key: key,
        after: after
      })
    })
  })

  // TODO is this buffering correct ?
  self.changes =  @Stream(function (emit) {
    @assert.is(closed, false)

    emitter ..@each { |x|
      if (x.type === "close") {
        break
      } else {
        emit(x)
      }
    }
  }) ..@buffer(Infinity)

  self.close = function () {
    @assert.is(closed, false)

    closed = true

    emitter ..@emit({
      type: "close"
    })
  }

  self.has = function (key) {
    return hash ..@has(key)
  }

  self.get = function (key) {
    return hash ..@get(key)
  }

  self.add = function (key, after) {
    @assert.is(closed, false)

    hash ..@setNew(key, after)

    emitter ..@emit({
      type: "add",
      key: key,
      after: after
    })
  }

  self.modify = function (key, f) {
    @assert.is(closed, false)

    @assert.is(self.has(key), true)

    var before = hash[key]
    var after  = f(before)
    @assert.is(hash[key], before)

    if (after !== before) {
      hash[key] = after

      emitter ..@emit({
        type: "modify",
        key: key,
        before: before,
        after: after
      })
    }
  }

  self.remove = function (key) {
    @assert.is(closed, false)

    var before = hash ..@get(key)
    delete hash[key]

    emitter ..@emit({
      type: "remove",
      key: key,
      before: before
    })
  }

  return self
}

exports.ObservableVar = function (value) {
  var self = @Emitter()

  // TODO make this into a module function ?
  self.get = function () {
    return value
  }

  // TODO make this into a module function ?
  // TODO what happens if this is retracted ?
  // TODO if set is called when a previous set is pending, retract the previous set ?
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
    // TODO if the check fails, maybe retry it, rather than throwing an error ?
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
    // TODO use `each` or `each.track` ?
    obs ..@each.track(function () {
      call(f, array)
    })
  })
}
