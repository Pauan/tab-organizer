@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" },
  { id: "lib:extension/server", name: "extension" },
  { id: "lib:util/observe" },
  { id: "lib:util/event" },
  { id: "./tabs" },
  { id: "./options" }
])


var type = @opt.get("counter.type")

@observe([type], function (type) {
  if (type === "in-chrome" || type === "total") {
    @extension.button.setColor(0, 0, 0, 0.9)
  } else {
    @assert.fail()
  }
})


var tabCount = @observe([type], function (type) {
  if (type === "in-chrome") {
    var i = 0
    @extension.windows.getCurrent() ..@each(function (window) {
      i += window.tabs.length
    })
    return i

  } else if (type === "total") {
    var i = 0
    @windows.getCurrent() ..@each(function (window) {
      i += window.children.length
    })
    return i

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


@tabs.on.open ..@listen(function () {
  if (type.get() === "total") {
    add1()
  }
})

@tabs.on.close ..@listen(function () {
  if (type.get() === "total") {
    sub1()
  }
})

@extension.tabs.on.open ..@listen(function () {
  if (type.get() === "in-chrome") {
    add1()
  }
})

@extension.tabs.on.close ..@listen(function () {
  if (type.get() === "in-chrome") {
    sub1()
  }
})


@observe([tabCount, @opt.get("counter.enabled")], function (i, enabled) {
  if (enabled) {
    @extension.button.setText(i)
  } else {
    // TODO I don't like how setting this to "" hides the badge
    @extension.button.setText("")
  }
})


console.info("counter: finished")
