@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:object" },
  { id: "sjs:sequence" },
  { id: "lib:extension/client" },
  { id: "lib:util/util" },
  { id: "lib:util/observe" }
])


var windows_id = {}
var tabs_id    = {}


exports.windows = @connection.connect("tabs").windows ..@indexed ..@map(function ([i, info]) {
  var window = {
    id: info.id,

    name: (info ..@has("name")
            ? info ..@get("name")
            : "" + (i + 1)),

    tabs: info.children ..@map(function (tab) {
      tabs_id ..@setNew(tab.id, tab)
      return tab
    }) ..@ObservableArray
  }

  windows_id ..@setNew(info.id, window)

  return window
}) ..@ObservableArray


spawn @connection.on.message("tabs") ..@each(function (event) {
  if (event.type === "tab.open") {
    var window = windows_id ..@get(event.window)
    tabs_id ..@setNew(event.tab.id, event.tab)
    window.tabs.nth_add(event.index, event.tab)

  } else if (event.type === "tab.close") {
    var tab = tabs_id ..@get(event.tab.id)
    var window = windows_id ..@get(event.window)

    @assert.is(window.tabs.nth(event.index), tab)
    @assert.is(tab.id, event.tab.id)

    window.tabs.nth_remove(event.index)
    tabs_id ..@delete(tab.id)

  } else if (event.type === "tab.update") {
    var tab = tabs_id ..@get(event.tab.id)
    var window = windows_id ..@get(event.window)
    var index = window.tabs.nth_of(tab) // TODO this is linear

    @assert.is(event.tab.id, tab.id)
    tabs_id ..@set(event.tab.id, event.tab)

    if (tab.url === event.tab.url) {
      window.tabs.nth_modify(index, function () {
        return event.tab
      })
    } else {
      window.tabs.nth_remove(index)
      window.tabs.nth_add(index, event.tab)
    }

  } else {
    // TODO enable this
    //@assert.fail()
  }
})


console.info("sync/tabs: finished")
