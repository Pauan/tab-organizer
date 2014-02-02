goog.provide("tabs")

goog.require("util.cell")
goog.require("util.array")
goog.require("util.object")
goog.require("util.log")
goog.require("deserialize")
goog.require("platform.port")

goog.scope(function () {
  var cell   = util.cell
    , array  = util.array
    , object = util.object
    , assert = util.log.assert
    , fail   = util.log.fail

  var oTabs = {}
    , oWins = {}

  tabs.on = cell.value(undefined)

  tabs.loaded = cell.dedupe(false)

  function getIds(a) {
    return array.map(a, function (x) {
      return x.id
    })
  }

  var port = platform.port.connect("tabs", function (x) {
    console["log"](x["tabs"], x["windows"])

    object.each(x["windows"], function (x) {
      var y = deserialize.window(x)
      oWins[y.id] = y
    })

    object.each(x["tabs"], function (x) {
      var y = deserialize.tab(x, oWins)
      oTabs[y.id] = y
    })

    tabs.loaded.set(true)
  })

  cell.event([port.on.message], function (x) {
    var r = []
    array.each(x, function (o) {
      var type = o["type"]
        , x    = o["value"]

      if (type === "window-opened") {
        var y = deserialize.window(x)
        oWins[y.id] = y

      } else if (type === "window-closed") {
        delete oWins[x]

      } else if (type === "window-renamed") {
        assert(x["id"] in oWins)
        oWins[x["id"]].name.set(x["name"])

      } else {
        var y = deserialize.tab(x, oWins)

        if (type === "created"     ||
            type === "updated"     ||
            type === "moved"       ||
            type === "updateIndex" ||
            type === "focused"     ||
            type === "unfocused") {
          oTabs[y.id] = y

        } else if (type === "removed") {
          delete oTabs[y.id]

        } else {
          fail()
        }

        array.push(r, {
          type: type,
          value: y
        })
      }
    })
    tabs.on.set(r)
  })

  tabs.getAll = function () {
    assert(tabs.loaded.get(), "tabs")
    return oTabs
  }

  tabs.close = function (a) {
    assert(tabs.loaded.get(), "tabs")
    assert(!!array.len(a))
    port.message({ "type": "close", "value": getIds(a) })
  }

  tabs.focus = function (tab) {
    assert(tabs.loaded.get(), "tabs")
    port.message({ "type": "focus", "value": tab.id })
  }

  tabs.unload = function (a) {
    assert(tabs.loaded.get(), "tabs")
    assert(!!array.len(a))
    port.message({ "type": "unload", "value": getIds(a) })
  }

  tabs.select = function (a) {
    if (array.len(a)) {
      var r = []
      array.each(a, function (x) {
        x.selected = true
        array.push(r, {
          type: "selected",
          value: x
        })
      })
      tabs.on.set(r)
      //port.message({ "type": "select", "value": getIds(a) })
    }
  }

  tabs.deselect = function (a) {
    if (array.len(a)) {
      var r = []
      array.each(a, function (x) {
        delete x.selected
        array.push(r, {
          type: "deselected",
          value: x
        })
      })
      tabs.on.set(r)
      //port.message({ "type": "deselect", "value": getIds(a) })
    }
  }

  tabs.addToGroup = function (s, a) {
    assert(!!array.len(a))
    port.message({ "type": "addToGroup", "group": s, "value": getIds(a) })
  }

  tabs.removeFromGroup = function (s, a) {
    assert(!!array.len(a))
    port.message({ "type": "removeFromGroup", "group": s, "value": getIds(a) })
  }
})
