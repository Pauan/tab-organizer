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

/**
  * @module extension.config
  **/
exports.checkError = function () {
  if (chrome.runtime.lastError != null) {
    console.log(typeof chrome.runtime.lastError, chrome.runtime.lastError)
    throw chrome.runtime.lastError
  }
}
