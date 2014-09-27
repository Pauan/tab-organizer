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
  if (type === "in-chrome") {
    var i = 0
    @extension.windows.getCurrent() ..@each(function (window) {
      i += window.tabs.length
    })
    tabCount.set(i)

  } else if (type === "total") {
    var i = 0
    @windows.getCurrent() ..@each(function (window) {
      i += window.children.length
    })
    tabCount.set(i)

  } else {
    @assert.fail()
  }
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
  if (type.get() === "total") {
    if (event.type === "tabs.open") {
      console.log("TOTAL", event.type)
      add1()
    } else if (event.type === "tabs.close") {
      console.log("TOTAL", event.type)
      sub1()
    }
  }
})

spawn @extension.tabs.events ..@each(function (event) {
  if (type.get() === "in-chrome") {
    if (event.type === "tabs.open") {
      console.log("CHROME", event.type)
      add1()
    } else if (event.type === "tabs.close") {
      console.log("CHROME", event.type)
      sub1()
    }
  }
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
