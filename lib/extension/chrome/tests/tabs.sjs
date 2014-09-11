this.document = {
  readyState: "complete"
}

var windows = [{
}]

function listener() {
  var funcs = []
  return {
    addListener: function (f) {
      funcs.push(f)
    },
    emit: function (x) {
      funcs.forEach(function (f) {
        f(x)
      })
    }
  }
}

this.chrome = {
  runtime: {
    lastError: null
  },
  windows: {
    update: null,
    getAll: function (obj, f) {
      setTimeout(function () {
        f(windows)
      }, 0)
    },
    onCreated: listener(),
    onRemoved: listener()
  },
  tabs: {
    get: null,
    create: null,
    onCreated: listener(),
    onUpdated: listener(),
    onRemoved: listener(),
    onReplaced: listener(),
    onActivated: listener(),
    onMoved: listener(),
    onDetached: listener(),
    onAttached: listener()
  }
}

console.log(this.chrome.tabs.onCreated)

@ = require([
  { id: "sjs:test/suite" },
  { id: "../tabs" }
])

@context("foo", function () {

})
