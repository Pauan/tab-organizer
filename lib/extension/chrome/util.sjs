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
    throw chrome.runtime.lastError
  }
}

exports.getAllWindows = function () {
  // This is necessary because sometimes Chrome will give incorrect results for
  // chrome.windows.getAll if you call it before the window.onload event
  // TODO perhaps this was only true in old versions, and I can remove this now?
  exports.waitUntilLoaded()
  // TODO what about retraction?
  waitfor (var result) {
    chrome.windows.getAll({ populate: true }, function (windows) {
      exports.checkError()
      resume(windows)
    })
  }
  return result
}
