@ = require([
  { id: "./util" }
])

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

/*exports.delete = function (name) {
  waitfor () {
    // TODO what about retraction ?
    chrome.storage.local.remove(name, function () {
      @checkError()
      resume()
    })
  }
}*/
