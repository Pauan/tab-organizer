/*
var queue = {}

if (!(name in queue)) {
  queue[name] = spawn ...
}

queue[name].value()
*/


@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "../../util/util" },
  { id: "./util" }
])


function getDB() {
  waitfor (var result) {
    chrome.storage.local.get(null, function (o) {
      @checkError()
      resume(o)
    })
  // TODO test this
  } retract {
    throw new Error("db: cannot retract during initialization")
  }

  return result
}


var db = getDB()

var timer = {}

var delay = {}


exports.delay = function (name, ms, f) {
  // TODO object/has
  // This is so it won't keep resetting it over and over again
  if (name in delay) {
    @assert.is(delay[name], ms)

  } else {
    // Set the delay
    delay[name] = ms

    // TODO object/has
    // Restart the timer, if it exists
    if (name in timer) {
      timer[name]()
    }
  }

  var result = f()
  // TODO object/has
  @assert.ok(name in timer)
  return result
}

exports.get = function (name, def) {
  // TODO object/get
  if (name in db) {
    return db[name]
  } else if (arguments.length === 2) {
    return def
  } else {
    throw new Error("db/get: #{name} does not exist")
  }
}


// TODO what about retractions ?
exports.set = function (name, value) {
  db[name] = value

  // TODO object/has
  if (!(name in timer)) {
    var timeout = null

    timer ..@setNew(name, function () {
      clearTimeout(timeout)

      timeout = setTimeout(function () {
        var o = {}
        o[name] = db[name]

        // This has to be here in case exports.set is called after
        // chrome.storage.local.set is called, but before it finishes
        timer ..@delete(name)
        delete delay[name]

        chrome.storage.local.set(o, function () {
          @checkError()

          console.info("db/set: #{name}")
        })
      }, delay[name] || 1000)
    })

    timer[name]()
  }
}

// TODO use a queue for this one too?
// TODO what about retractions ?
// TODO fix this
exports["delete"] = function (name) {
  db ..@delete(name)

  chrome.storage.local.remove(name, function () {
    @checkError()

    console.info("db/delete: #{name}")
  })
}
