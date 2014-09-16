@ = require([
  { id: "sjs:assert", name: "assert" }
])

@assert.ok(typeof document.readyState === "string")

// TODO what if the "load" event never fires?
exports.waitUntilLoaded = function () {
  if (document.readyState !== "complete") {
    waitfor () {
      addEventListener("load", resume, true)
    } finally {
      removeEventListener("load", resume, true)
    }
  }
}

exports.checkError = function () {
  if (chrome.runtime.lastError != null) {
    console.log(typeof chrome.runtime.lastError, chrome.runtime.lastError)
    return new Error(chrome.runtime.lastError)
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
