goog.provide("tabs")

goog.require("util.cell")
goog.require("util.array")
goog.require("util.log")
goog.require("platform.tabs")
goog.require("platform.util")
goog.require("platform.port")
goog.require("platform.db")
goog.require("serialize")
goog.require("migrate")
goog.require("opt")

goog.scope(function () {
  var cell   = util.cell
    , array  = util.array
    , assert = util.log.assert
    , fail   = util.log.fail
    , log    = util.log.log
    , db     = platform.db

  var popupId = platform.util.getURL("../panel.html")

  function isValidURL(s) {
    return s !== "" &&
           s !== popupId// &&
           //s !== "chrome://newtab/"
  }

  tabs.loaded = cell.dedupe(false)

  function send(type, o) {
    platform.port.message("tabs", { "type": type, "value": o })
  }

  function set(type, t) {
    send(type, (oTabs[t.id] = serialize.tab(t)))
  }

  function rem(type, t) {
    delete oTabs[t.id]
    send(type, serialize.tab(t))
  }

  var oTabs = {}

  tabs.init = function () {
    cell.when(cell.and(db.loaded, migrate.loaded, opt.loaded, platform.tabs.loaded, platform.windows.loaded), function () {
      var aNames = db.raw("window.titles")
      aNames.setNew([])

      var oWins = {}

      function getDefaultName(win) {
        return "" + (win.index + 1)
      }

      function getWindowName(win) {
        return aNames.get()[win.index] || getDefaultName(win)
      }

      function addWin(win) {
        return (oWins[win.id] = serialize.window(win))
      }

      function getLength(a) {
        var i = array.len(a)
        while (i--) {
          if (a[i] != null) {
            return i + 1
          }
        }
        return 0
      }

      function renameWin(win, name) {
        if (win.name !== name) {
          var a = aNames.get()
          if (name === getDefaultName(win)) {
            a[win.index] = null
            array.resize(a, getLength(a))
          } else {
            a[win.index] = name
          }
          aNames.set(array.map(a, function (x) {
            if (x == null) {
              return null
            } else {
              return x
            }
          }))

          win.name = name
          platform.port.message("tabs", {
            "type": "window-renamed",
            "value": addWin(win)
          })
        }
      }

      array.each(platform.windows.getAll(), function (win) {
        win.name = getWindowName(win)
        addWin(win)
      })

      cell.event([platform.windows.on.created], function (win) {
        win.name = getWindowName(win)
        platform.port.message("tabs", {
          "type": "window-opened",
          "value": addWin(win)
        })
      })

      cell.event([platform.windows.on.removed], function (win) {
        var a = aNames.get()
        array.removeAt(a, win.index)
        array.resize(a, getLength(a))
        aNames.set(a)

        delete oWins[win.id]
        platform.port.message("tabs", {
          "type": "window-closed",
          "value": win.id
        })

        // TODO platform.windows.on.updateIndex
        array.each(platform.windows.getAll(), function (win) {
          assert(win.id in oWins)
          renameWin(win, getWindowName(win))
        })
      })



      array.each(platform.tabs.getAll(), function (t) {
        if (isValidURL(t.url)) {
          oTabs[t.id] = serialize.tab(t)
        } else {
          delete oTabs[t.id]
        }
      })

      // TODO maybe this should do nothing if the URL is ""
      function onCreated(t) {
        var old = oTabs[t.id]
        if (isValidURL(t.url)) {
          if (old == null) {
            set("created", t)
          } else {
            set("updated", t)
          }
        // TODO test this
        } else if (old != null) {
          assert(false, "REMOVING " + old.url + " " + t.url)
          // TODO code duplication
          delete oTabs[t.id]
          send("removed", old)
        }
      }
      cell.event([platform.tabs.on.created], onCreated)
      cell.event([platform.tabs.on.updated], onCreated)

      cell.event([platform.tabs.on.moved], function (t) {
        if (oTabs[t.id] != null) {
          set("moved", t)
        }
      })

      cell.event([platform.tabs.on.updateIndex], function (a) {
        array.each(a, function (t) {
          if (oTabs[t.id] != null) {
            set("updateIndex", t)
          }
        })
      })

      cell.event([platform.tabs.on.removed], function (info) {
        log(info.windowClosing)
        var t = info.tab
        if (oTabs[t.id] != null) {
          rem("removed", t)
        }
      })

      cell.event([platform.tabs.on.unfocused], function (t) {
        if (oTabs[t.id] != null) {
          set("unfocused", t)
        }
      })

      cell.event([platform.tabs.on.focused], function (t) {
        if (oTabs[t.id] != null) {
          set("focused", t)
        }
      })

      cell.event([platform.port.on.connect("tabs")], function (port) {
        log("CONNECT", oTabs)
        port.message({ "tabs": oTabs, "windows": oWins })
      })

      cell.event([platform.port.on.message("tabs")], function (a) {
        array.each(a, function (o) {
          var type  = o["type"]
            , value = o["value"]

          if (type === "close") {
            platform.tabs.close(value)

          } else if (type === "focus") {
            platform.tabs.focus(value)

          } else if (type === "move") {
            platform.tabs.move(value, o["index"], o["window"])

          } else if (type === "unload") {

          } else if (type === "window-rename") {
            renameWin(platform.windows.get(o["id"]), value)

          } else {
            fail()
          }
        })
      })

      tabs.loaded.set(true)
    })
  }
})
