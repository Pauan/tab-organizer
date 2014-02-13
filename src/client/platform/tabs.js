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
    , log    = util.log.log

  var oTabs = {}
    , oWins = {}

  tabs.on             = {}
  tabs.on.opened      = cell.value(undefined)
  tabs.on.updated     = cell.value(undefined)
  tabs.on.updatedOld  = cell.value(undefined)
  tabs.on.moved       = cell.value(undefined)
  tabs.on.focused     = cell.value(undefined)
  tabs.on.updateIndex = cell.value(undefined)
  tabs.on.unfocused   = cell.value(undefined)
  tabs.on.selected    = cell.value(undefined)
  tabs.on.deselected  = cell.value(undefined)
  tabs.on.closed      = cell.value(undefined)

  tabs.loaded = cell.dedupe(false)

  tabs.all = null

  function getIds(a) {
    return array.map(a, function (x) {
      return x.id
    })
  }

  function addWindow(x) {
    var y = deserialize.window(x)
    y.name = cell.dedupe(y.name, {
      set: function (self, x) {
        port.message({ "type": "window-rename", "id": y.id, "value": x })
      }
    })
    oWins[y.id] = y
  }

  function addTab(y) {
    //y.focused = cell.dedupe(y.focused)
    oTabs[y.id] = y
  }

  var port = platform.port.connect("tabs", function (x) {
    tabs.all = cell.value(oTabs)
    object.each(x["windows"], function (x) {
      addWindow(x)
    })
    object.each(x["tabs"], function (x) {
      addTab(deserialize.tab(x, oWins))
    })
    tabs.loaded.set(true)
  })

  cell.event([port.on.message], function (x) {
    var seen = false

    array.each(x, function (o) {
      var type = o["type"]
        , x    = o["value"]

      if (type === "window-opened") {
        addWindow(x)

      } else if (type === "window-closed") {
        delete oWins[x]

      } else if (type === "window-renamed") {
        assert(x["id"] in oWins)
        oWins[x["id"]].name.set(x["name"])

      } else {
        var y = deserialize.tab(x, oWins)

        if (type === "created") {
          addTab(y)
          tabs.on.opened.set(y)

        } else if (type === "updated") {
          var old = oTabs[y.id]
          assert(old != null)
          addTab(y)
          tabs.on.updated.set(y)
          tabs.on.updatedOld.set(old)

        } else if (type === "moved") {
          addTab(y)
          tabs.on.moved.set(y)

        } else if (type === "updateIndex") {
          addTab(y)
          tabs.on.updateIndex.set(y)

        } else if (type === "focused") {
          addTab(y)
          tabs.on.focused.set(y)

        } else if (type === "unfocused") {
          addTab(y)
          tabs.on.unfocused.set(y)

        } else if (type === "removed") {
          delete oTabs[y.id]
          tabs.on.closed.set(y)

        } else {
          fail()
        }

        seen = true
      }
    })

    if (seen) {
      tabs.all.set(tabs.all.get())
    }
  })

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

  tabs.move = function (a, i) {
    assert(tabs.loaded.get(), "tabs")
    port.message({ "type": "move", "value": getIds(a), "index": i })
  }

  tabs.select = function (a) {
    if (array.len(a)) {
      array.each(a, function (x) {
        x.selected = true
        tabs.on.selected.set(x)
      })
      tabs.all.set(tabs.all.get())
      //port.message({ "type": "select", "value": getIds(a) })
    }
  }

  tabs.deselect = function (a) {
    if (array.len(a)) {
      array.each(a, function (x) {
        delete x.selected
        tabs.on.deselected.set(x)
      })
      tabs.all.set(tabs.all.get())
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
