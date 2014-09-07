@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" },
  //{ id: "sjs:object" },
  { id: "../../util/event" },
  { id: "./util" }
])

var onConnect = {}
var onMessage = {}
var queue     = {}
var ports     = {}

function message(name, type, value) {
  // TODO object/has
  if (name in ports) {
    ports[name] ..@each(function (port) {
      port.postMessage({
        type: type,
        value: value
      })
    })
  }
}

exports.on = {}

exports.on.connect = function (name) {
  // TODO object/has
  // TODO library function for this
  if (!(name in onConnect)) {
    onConnect[name] = @Emitter()
  }
  return onConnect[name]
}

exports.send = function (name, value) {
  // TODO object/has
  if (name in queue) {
    queue[name].push(value)
  } else {
    queue[name] = [value]

    setTimeout(function () {
      console.log(queue[name])
      message(name, "batch", queue[name])
      queue ..@delete(name)
    }, 100)
  }
}


// TODO what about when the port disconnects ?
chrome.runtime.onConnect.addListener(function (port) {
  var s = port.name

  // TODO utility for this
  var a = ports[s]
  if (a == null) {
    a = ports[s] = []
  }
  a ..@pushNew(port)

  port.onDisconnect.addListener(function () {
    a ..@remove(port)

    // TODO utility for this
    if (a.length === 0) {
      ports ..@delete(s)
    }
  })

  port.onMessage.addListener(function (o) {
    console.log(o)
    // TODO object/has
    if (s in onMessage) {
      // TODO should this be emit or emitSync?
      onMessage[s] ..@emitSync(o)
    }
  })

  // TODO object/has
  if (s in onConnect) {
    // TODO should this be emit or emitSync?
    onConnect[s] ..@emitSync({
      send: function (x) {
        port.postMessage({ type: "init", value: x })
      }
    })
  }
})
