@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" },
  //{ id: "sjs:object" },
  { id: "../../util/event" },
  { id: "../../util/util" },
  { id: "./util" }
])

var onCommand = {}
var onConnect = {}
var onMessage = {}
var queue     = {}
var ports     = {}

function message(name, type, value) {
  // TODO object/has
  if (name in ports) {
    ports[name] ..@each(function (port) {
      port.postMessage({ type: type, value: value })
    })
  }
}

exports.on = {}

exports.on.command = function (name, f) {
  onCommand ..@setNew(name, f)
}

exports.on.connect = function (name) {
  // TODO object/has
  // TODO library function for this
  if (!(name in onConnect)) {
    onConnect[name] = @Emitter()
  }
  return onConnect[name]
}

exports.on.message = function (name) {
  // TODO object/has
  // TODO library function for this
  if (!(name in onMessage)) {
    onMessage[name] = @Emitter()
  }
  return onMessage[name]
}

exports.send = function (name, value) {
  // TODO object/has
  if (name in queue) {
    // TODO pushNew ?
    queue[name].push(value)
  } else {
    queue[name] = [value]

    setTimeout(function () {
      message(name, "batch", queue[name])
      queue ..@delete(name)
    }, 100)
  }
}


chrome.runtime.onMessage.addListener(function (message, sender, reply) {
  // TODO object/has
  if (message.type in onCommand) {
    // TODO is this correct ?
    reply(onCommand[message.type](message.value))
    //return true
  }
})


// TODO what about when the port disconnects, is it okay to call postMessage ?
chrome.runtime.onConnect.addListener(function (port) {
  @checkError()

  var s = port.name

  // TODO utility for this
  var a = ports[s]
  if (a == null) {
    a = ports[s] = []
  }
  a ..@pushNew(port)

  port.onDisconnect.addListener(function () {
    @checkError()

    a ..@remove(port)

    // TODO utility for this
    if (a.length === 0) {
      ports ..@delete(s)
    }
  })

  port.onMessage.addListener(function (o) {
    @checkError()

    console.log(o)
    // TODO object/has
    if (s in onMessage) {
      onMessage[s] ..@emit(o)
    }
  })

  // TODO object/has
  if (s in onConnect) {
    console.log("HIYA CONNECT")
    // TODO if it doesn't call send, should sending be disabled for this port ?
    onConnect[s] ..@emit({
      send: function (x) {
        port.postMessage({ type: "init", value: x })
      }
    })
  }
})
