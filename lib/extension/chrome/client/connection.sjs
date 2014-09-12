@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" },
  { id: "lib:util/event" },
  { id: "../util" }
])


var onMessage = {}
var ports     = {}
var queue     = {}


// TODO what about disconnects ?
function connect(name) {
  // TODO object/has
  if (!(name in ports)) {
    var port = chrome.runtime.connect({ name: name })

    ports[name] = {
      port: port
    }

    waitfor (var result) {
      function init(o) {
        @checkError()

        @assert.is(o.type, "init")
        resume(o.value)
      }

      port.onMessage.addListener(init)
      @assert.is(port.onMessage.hasListeners(), true)
    } retract {
      throw new Error("extension.chrome.connection: cannot retract when initializing port")
    } finally {
      port.onMessage.removeListener(init)
    }

    @assert.is(port.onMessage.hasListeners(), false)

    port.onMessage.addListener(function (o) {
      @checkError()

      @assert.is(o.type, "batch")

      // TODO object/has
      if (name in onMessage) {
        var listener = onMessage[name]
        o.value ..@each(function (x) {
          listener ..@emit(x)
        })
      }
    })

    ports[name].value = result
  }

  return ports[name].value
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
  if (name in queue) {
    // TODO pushNew ?
    queue[name].push(value)
  } else {
    queue[name] = [value]

    setTimeout(function () {
      ports[name].port.postMessage({ type: "batch", value: queue[name] })
      queue ..@delete(name)
    }, 100)
  }
}

exports.command = function (type, value) {
  waitfor (var result) {
    chrome.runtime.sendMessage({ type: type, value: value }, function (x) {
      @checkError()
      resume(x)
    })
  } retract {
    throw new Error("extension.chrome.connection: cannot retract when sending a command")
  }

  return result
}
