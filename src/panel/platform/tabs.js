goog.provide("tabs")

goog.require("util.cell")
goog.require("util.array")
goog.require("util.object")
goog.require("util.log")
goog.require("tabs.serialize")
goog.require("platform.port")

goog.scope(function () {
  var cell        = util.cell
    , array       = util.array
    , object      = util.object
    , assert      = util.log.assert
    , fail        = util.log.fail
    , deserialize = tabs.serialize.deserialize

  var oTabs = {}

  tabs.on = cell.value(undefined)

  tabs.loaded = cell.dedupe(false)

  var port = platform.port.connect("tabs", function (x) {
    object.each(x, function (x) {
      x = deserialize(x)
      oTabs[x.id] = x
    })
    tabs.loaded.set(true)
  })

  cell.event([port.on.message], function (x) {
    array.each(x, function (o) {
      o["value"] = deserialize(o["value"])
      var type = o["type"]
        , x    = o["value"]
      if (type === "created"     ||
          type === "updated"     ||
          type === "moved"       ||
          type === "updateIndex" ||
          type === "focused"     ||
          type === "unfocused") {
        oTabs[x.id] = x
      } else if (type === "removed") {
        delete oTabs[x.id]
      } else {
        fail()
      }
    })
    tabs.on.set(x)
  })

  tabs.getAll = function () {
    assert(tabs.loaded.get(), "tabs")
    return oTabs
  }

  tabs.close = function (a) {
    assert(tabs.loaded.get(), "tabs")
    assert(array.len(a))
    port.message({ "type": "close", "value": array.map(a, function (x) { return x.id }) })
  }

  tabs.focus = function (tab) {
    assert(tabs.loaded.get(), "tabs")
    port.message({ "type": "focus", "value": tab.id })
  }

  tabs.unload = function (a) {
    assert(tabs.loaded.get(), "tabs")
    assert(array.len(a))
    port.message({ "type": "unload", "value": array.map(a, function (x) { return x.id }) })
  }

  /*platform.tabs.select = function (a) {
    if (array.len(a)) {
      var r = []
      array.each(a, function (x) {
        x.selected = 1
        r.push({
          "type": "select",
          "value": x
        })
      })
      platform.tabs.on.set(r)
      port["postMessage"]({ "type": "select", "value": array.map(a, function (x) { return x.id }) })
    }
  }

  platform.tabs.deselect = function (a) {
    if (a.length) {
      var r = []
      array.each(a, function (s) {
        delete tabs[s].selected
        r.push({
          type: "updateRaw",
          value: tabs[s]
        })
      })
      platform.tabs.on.set(r)
      port.postMessage({ type: "deselect", value: a })
    }
  }

  platform.tabs.addToGroup = function (s, a) {
    console.assert(a.length)
    port.postMessage({ type: "addToGroup", group: s, value: a })
  }

  platform.tabs.removeFromGroup = function (s, a) {
    console.assert(a.length)
    port.postMessage({ type: "removeFromGroup", group: s, value: a })
  }*/
})
