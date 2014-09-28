@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" },
  { id: "lib:extension/server", name: "extension" },
  { id: "lib:util/observe" },
  { id: "./tabs" },
  { id: "./options" }
])


var type = @opt.get("counter.type")

spawn @observe([type], function (type) {
  if (type === "in-chrome" || type === "total") {
    @extension.button.setColor(0, 0, 0, 0.9)
  } else {
    @assert.fail()
  }
})


var tabCount = @Observer()

spawn @observe([type], function (type) {
  var i = 0
  @windows.getCurrent() ..@each(function (window) {
    window.children ..@each(function (tab) {
      if (type === "in-chrome") {
        if (tab.active) {
          ++i
        }
      } else if (type === "total") {
        ++i
      } else {
        @assert.fail()
      }
    })
  })
  tabCount.set(i)
})

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


spawn @tabs.events ..@each(function (event) {
  if (event.type === "tabs.open") {
    console.log("TOTAL", event.type, event.tab)
    add1()
  } else if (event.type === "tabs.close") {
    console.log("TOTAL", event.type, event.tab)
    sub1()
  }

  /*if (type.get() === "total") {

  }*/
})


spawn @observe([tabCount, @opt.get("counter.enabled")], function (i, enabled) {
  if (enabled) {
    @extension.button.setText(i)
  } else {
    // TODO I don't like how setting this to "" hides the badge
    @extension.button.setText("")
  }
})


console.info("counter: finished")
