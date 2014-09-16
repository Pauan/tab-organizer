@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" },
  { id: "sjs:object" },
  { id: "lib:util/event" },
  { id: "lib:util/util" },
  { id: "../util" }
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

exports.on.connect = function (name, f) {
  onConnect ..@setNew(name, f)
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
  if (onCommand ..@has(message.type)) {
    var f = onCommand ..@get(message.type)
    spawn reply({ value: f(message.value) })
    return true
  } else {
    var s = "message #{message.type} is not recognized"
    reply({ error: s })
    throw new Error(s)
  }
})


// TODO what about when the port disconnects, is it okay to call postMessage ?
chrome.runtime.onConnect.addListener(function (port) {
  @throwError()

  var s = port.name

  // TODO utility for this
  var a = ports[s]
  if (a == null) {
    a = ports[s] = []
  }
  a ..@pushNew(port)

  port.onDisconnect.addListener(function () {
    @throwError()

    a ..@remove(port)

    // TODO utility for this
    if (a.length === 0) {
      ports ..@delete(s)
    }
  })

  port.onMessage.addListener(function (o) {
    @throwError()

    @assert.is(o.type, "batch")

    // TODO object/has
    @assert.ok(s in onMessage)

    // TODO object/get
    var listener = onMessage[s]
    o.value ..@each(function (o) {
      listener ..@emit(o)
    })
  })


  var listener = onConnect ..@get(s)

  port.postMessage({
    type: "init",
    value: listener()
  })
})
