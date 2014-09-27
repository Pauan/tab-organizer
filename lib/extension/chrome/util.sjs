@ = require([
  { id: "sjs:assert", name: "assert" }
])

exports.checkError = function () {
  if (chrome.runtime.lastError != null) {
    return new Error(chrome.runtime.lastError.message)
  } else {
    return null
  }
}

// TODO this is a bit hacky... would be nice to replace this with waitfor + checkError
exports.throwError = function () {
  var err = exports.checkError()
  if (err) {
    throw err
  }
}
