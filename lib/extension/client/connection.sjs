@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" },
  { id: "sjs:object" },
  { id: "lib:util/util" },
  { id: "lib:util/event" },
  { id: "../util" }
])


var onMessage = {}
var ports     = {}
var queue     = {}


// TODO what about disconnects ?
function connect(name) {
  var port = ports ..@get_or_set(name, function () {
    var port = chrome.runtime.connect({ name: name })

    var o = {
      port: port
    }

    @assert.is(port.onMessage.hasListeners(), false)

    waitfor (var err, result) {
      function init(o) {
        var err = @checkError()
        if (err) {
          resume(err)
        } else {
          resume(null, o)
        }
      }

      port.onMessage.addListener(init)
    } retract {
      throw new Error("extension.chrome.connection: cannot retract when initializing port")
    } finally {
      @assert.is(port.onMessage.hasListeners(), true)
      port.onMessage.removeListener(init)
    }

    if (err) {
      throw err
    } else {
      @assert.is(result.type, "init")

      @assert.is(port.onMessage.hasListeners(), false)

      port.onMessage.addListener(function (o) {
        @throwError()

        @assert.is(o.type, "batch")

        // TODO object/has
        if (name in onMessage) {
          var listener = onMessage[name]
          o.value ..@each(function (x) {
            listener ..@emit(x)
          })
        }
      })

      o.value = result.value

      return o
    }
  })

  return port.value
}


exports.on = {}

exports.on.message = function (name) {
  // This is so that messaging works regardless of whether consumers call connect or not
  connect(name)

  // TODO object/has
  if (!(name in onMessage)) {
    onMessage[name] = @Emitter()
  }

  return onMessage[name]
}

exports.connect = function (name) {
  return connect(name)
}

// TODO what if this is called multiple times concurrently ?
// TODO code duplication with server/connection.sjs
exports.send = function (name, value) {
  // This is so that messaging works regardless of whether consumers call connect or not
  connect(name)

  // TODO object/has
  // TODO util/getset
  if (name in queue) {
    // TODO pushNew ?
    queue ..@get(name) ..@push(value)
  } else {
    queue ..@setNew(name, [value])

    setTimeout(function () {
      (ports ..@get(name)).port.postMessage({ type: "batch", value: queue[name] })
      queue ..@delete(name)
    }, 100)
  }
}

exports.command = function (type, value) {
  waitfor (var err, result) {
    chrome.runtime.sendMessage({ type: type, value: value }, function (x) {
      var err = @checkError()
      if (err) {
        resume(err)
      } else {
        resume(null, x)
      }
    })
  } retract {
    throw new Error("extension.chrome.connection: cannot retract when sending a command")
  }

  // We have to use this style because otherwise an error in client will be swallowed up and shown in the server instead
  if (err) {
    throw err
  } else {
    if (result ..@has("error")) {
      throw new Error(result ..@get("error"))
    } else {
      return result ..@get("value")
    }
  }
}
