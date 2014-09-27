@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" }
])


exports.pending_limit = 1024

exports.closed = {}


function wake(array, value) {
  var f = array.shift()
  return f(value)
}

function sleep(chan_this, value) {
  if (chan_this.length < exports.pending_limit) {
    // TODO why doesn't this hold work ?
    // hold(0)
    waitfor (var result) {
      function done(x) {
        // TODO is this a good spot for this ?
        // TODO is there a better way than using hold(0) ?
        hold(0)
        resume(x)
        return value
      }
      chan_this.push(done)
    } retract {
      var index = chan_this.indexOf(done)
      console.log("RETRACTED", index)
      @assert.isNot(index, -1) // TODO test if this is ever possible
      if (index !== -1) {
        chan_this.splice(index, 1)
      }
    }
    return result
  } else {
    throw new Error("cannot have more than #{exports.pending_limit} pending operations on a channel")
  }
}


// The behavior is the same as Clojure's core.async channels (http://clojure.github.io/core.async/)
exports.Channel = function () {
  // TODO what about pending receiver/sender when retracted ?
  var o = @Stream(function (emit) {
    while (true) {
      // TODO I would like to use `exports.take(this)`, but I can't
      var v = exports.take(o)
      if (v === exports.closed) {
        break
      } else {
        emit(v)
      }
    }
  })

  o.closed   = false
  o.receiver = []
  o.sender   = []

  return o
}

exports.take = function (channel) {
  if (channel.sender.length) {
    return wake(channel.sender, null)
  } else if (channel.closed) {
    return exports.closed
  } else {
    return sleep(channel.receiver, null)
  }
}

// TODO this used to return something even though it didn't use return! find out why
exports.put = function (channel, value) {
  if (channel.closed) {
    return false
  } else if (channel.receiver.length) {
    wake(channel.receiver, value)
    return true
  } else {
    sleep(channel.sender, value)
    return true
  }
}

exports.close = function (channel) {
  channel.closed = true

  while (channel.receiver.length) {
    wake(channel.receiver, exports.closed)
  }
}

exports.isClosed = function (channel) {
  return channel.closed
}




/*exports.choose = function (channels) {
  var o = exports.Channel()
  var eos = {}
  channels ..@consume(eos, function (next) {
    waitfor {
      next()
    } or {

    }
  })
  return o
}


exports.BufferedChannel = function (limit) {
  @assert.ok(limit != null && limit > 0)

  var o = Object.create(exports.BufferedChannel.prototype)
  o.closed   = false
  o.receiver = []
  o.sender   = []
  o.buffer   = []
  o.limit    = limit
  return o
}

exports.BufferedChannel.prototype = Object.create(exports.Channel.prototype)

// TODO handle close
exports.BufferedChannel.take = function () {
  if (!this.buffer.length) {
    if (this.closed) {
      return exports.closed
    } else {
      sleep(this.receiver, null)
    }
  }

  @assert.ok(this.buffer.length)

  var value = this.buffer.pop()

  if (this.sender.length) {
    wake(this.sender, null)
  }

  return value
}

exports.BufferedChannel.put = function (value) {
  if (this.closed) {
    return false
  } else {
    if (this.buffer.length >= this.limit) {
      sleep(this.sender, null)
    }

    @assert.ok(this.buffer.length < this.limit)

    this.buffer.push(value)

    if (this.receiver.length) {
      wake(this.receiver, null)
    }

    return true
  }
}*/


/*exports.with = function (channel, f) {
  waitfor {
    f()
  } or {

  }
}*/




/*exports.throttle = function (duration) {
  return function (reducer) {
    return function (seq, input) {
      hold(duration)
      return reducer(seq, input)
    }
  }
}

exports.map = function (f) {
  return function (reducer) {
    return function (seq, input) {
      return reducer(seq, f(input))
    }
  }
}*/

exports.pipe = function (from, to) {
  from ..@each { |x|
    if (!to ..exports.put(x)) {
      break
    }
  }
}


/*;(function () {
  var c = @Emitter()

  waitfor {
    c ..@buffer(Infinity) ..@each(function (x) {
      console.log("received #{x}")
      hold(1000)
    })
  } and {
    for (var i = 1; i <= 100; ++i) {
      c.emit(i)
      hold(500)
    }
  }
})()*/

/*;(function () {
  var c = exports.Channel()

  waitfor {
    c ..@buffer(1000) ..@each(function (x) {
      console.log("received #{x}");
      hold(1000)
    })
  } and {
    var time = new Date();
    for (var i = 1; i <= 10000; ++i) {
      console.log("Sourced waited #{new Date() - time} seconds");
      time = new Date();
      c ..exports.put(i)
      hold(500)
    }
    c ..exports.close
  }
})()*/


/*;(function () {
  var c = exports.Channel()

  for (var i = 1; i <= 3; ++i) {
    spawn (function (i) {
      c ..@each(function (v) {
        console.log("goroutine \##{i} took #{v}")
      })
    })(i)
  }

  for (var i = 1; i <= 1027; ++i) {
    spawn (function (i) {
      var v
      while ((v = c ..exports.put(i))) {
        console.log("goroutine \##{i} put #{i} and got #{v}")
      }
    })(i)
  }

  spawn (function () {
    hold(1000)
    c ..exports.close
    console.log("CLOSED")
  })()
})()*/
