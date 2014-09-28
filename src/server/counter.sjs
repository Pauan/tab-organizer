@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" },
  { id: "lib:extension/server", name: "extension" },
  { id: "lib:util/observe" },
  { id: "./tabs" },
  { id: "./options" }
])


var counter_loaded   = @opt.get("counter.display.loaded")
var counter_unloaded = @opt.get("counter.display.unloaded")


var tabCount = @Observer()

function tab_matches(tab, loaded, unloaded) {
  return (loaded   &&  tab.active) ||
         (unloaded && !tab.active)
}

function add1() {
  tabCount.modify(function (i) {
    return i + 1
  })
}

function sub1() {
  tabCount.modify(function (i) {
    return i - 1
  })
}

spawn @observe([counter_loaded, counter_unloaded], function (loaded, unloaded) {
  var i = 0
  @windows.getCurrent() ..@each(function (window) {
    window.children ..@each(function (tab) {
      if (tab_matches(tab, loaded, unloaded)) {
        ++i
      }
    })
  })
  tabCount.set(i)
})

spawn @tabs.events ..@each(function (event) {
  if (event.type === "tabs.open") {
    if (tab_matches(event.tab, counter_loaded.get(), counter_unloaded.get())) {
      add1()
    }

  } else if (event.type === "tabs.close") {
    if (tab_matches(event.tab, counter_loaded.get(), counter_unloaded.get())) {
      sub1()
    }
  }
})


@extension.button.setColor(0, 0, 0, 0.9)

spawn @observe([tabCount, @opt.get("counter.enabled")], function (i, enabled) {
  @assert.ok(i >= 0)

  if (enabled) {
    @extension.button.setText(i)
  } else {
    // TODO I don't like how setting this to "" hides the badge
    @extension.button.setText("")
  }
})


console.info("counter: finished")
