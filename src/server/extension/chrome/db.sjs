@ = require([
  { id: "../../util/util" },
  { id: "./util" }
])

var disabled = {}

exports.get = function (name, def) {
  waitfor (var result) {
    chrome.storage.local.get(name, function (items) {
      @checkError()
      if (name in items) {
        resume(items[name])
      } else {
        resume(def)
      }
    })
  }
  return result
}

exports.set = function (name, value) {
  if (disabled[name]) {
    console.debug("db: can't set because #{name} is disabled")
  } else {
    waitfor () {
      var o = {}
      o[name] = value
      // TODO what about retraction ?
      chrome.storage.local.set(o, function () {
        @checkError()

        console.info("db: saved #{name}")

        resume()
      })
    }
  }
}

// TODO fix this
exports["delete"] = function (name) {
  if (disabled[name]) {
    console.debug("db: can't delete because #{name} is disabled")
  } else {
    waitfor () {
      // TODO what about retraction ?
      chrome.storage.local.remove(name, function () {
        @checkError()

        console.info("db: deleted #{name}")

        resume()
      })
    }
  }
}

// TODO should these be more lenient (i.e. not throwing an error if called multiple times)?
exports.enable = function (name) {
  disabled ..@delete(name)
}

exports.disable = function (name, f) {
  if (arguments.length === 1) {
    disabled ..@setNew(name, true)
  } else {
    exports.disable(name)
    try {
      return f()
    } finally {
      exports.enable(name)
    }
  }
}
