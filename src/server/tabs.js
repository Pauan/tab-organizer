goog.provide("tabs")

goog.require("util.cell")
goog.require("util.array")
goog.require("util.object")
goog.require("util.log")
goog.require("util.time")
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
    , object = util.object
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

  function set(t, dTabs) {
    var o = serialize.tab(t)

    if (dTabs.has(o["url"]) && oActive[o["url"]] == null) {
      var saved = dTabs.get(o["url"])
      assert(saved["time"]["created"] !== o["time"]["created"])
      assert(saved["time"]["created"] !== o["id"])
      assert(oTabs[saved["time"]["created"]] != null)
      send("removed", oTabs[saved["time"]["created"]])
      delete oTabs[saved["time"]["created"]]
      serialize.setFromDisk(o, saved)
    }

    var old = oTabs[o["id"]]
    oTabs[o["id"]] = o

    addActive(o)
    if (old != null) {
      removeActive(old)
    }

    var a = oActive[o["url"]]
    assert(a != null)
    assert(array.indexOf(a, o) !== -1)
    if (array.len(a) === 1) {
      assert(a[0] === o)
      dTabs.set(o["url"], serialize.tabToDisk(a[0]))
    } else {
      dTabs.set(o["url"], array.foldl1(a, serialize.merge))
    }

    return o
  }

  function rem(t, dTabs) {
    delete oTabs[t["id"]]
    removeActive(t)
    if (oActive[t["url"]] == null) {
      dTabs.del(t["url"])
    }
    return t
  }

  var oTabs = {}

  var oActive = {}

  var oUnloaded = {}

  function addActive(x) {
    if (oActive[x["url"]] == null) {
      oActive[x["url"]] = []
    }
    array.push(oActive[x["url"]], x)
  }

  function removeActive(x) {
    var a = oActive[x["url"]]
    assert(a != null)
    assert(array.indexOf(a, x) !== -1)
    array.remove(a, x)
    if (array.len(a) === 0) {
      delete oActive[x["url"]]
    }
  }

  window["getActive"] = function () {
    return oActive
  }

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



      var dTabs = db.open("current.tabs")

      window["getTabs"] = function () {
        return dTabs.getAll()
      }

      window["delTabs"] = function () {
        dTabs.delAll()
      }

      object.each(dTabs.getAll(), function (x, s) {
        x = serialize.tabFromDisk(x, s)
        oTabs[x["id"]] = x
      })

      array.each(platform.tabs.getAll(), function (t) {
        assert(oUnloaded[t.id] == null)

        t.groups = {}

        if (isValidURL(t.url)) {
          assert(oTabs[t.id] == null)
          set(t, dTabs)
        // TODO is this correct ?
        } else {
          delete oTabs[t.id]
        }
      })

      cell.event([platform.tabs.on.created], function (t) {
        t.groups = {}
      })

      // TODO maybe this should do nothing if the URL is ""
      function onCreated(t) {
        assert(oUnloaded[t.id] == null)

        var old = oTabs[t.id]
        if (isValidURL(t.url)) {
          if (old == null) {
            send("created", set(t, dTabs))
          } else {
            send("updated", set(t, dTabs))
          }
        // TODO test this
        } else if (old != null) {
          assert(false, "REMOVING " + old.url + " " + t.url)
          send("removed", rem(old, dTabs))
        }
      }
      cell.event([platform.tabs.on.created], onCreated)
      cell.event([platform.tabs.on.updated], onCreated)

      cell.event([platform.tabs.on.moved], function (t) {
        assert(oUnloaded[t.id] == null)

        if (oTabs[t.id] != null) {
          send("moved", set(t, dTabs))
        }
      })

      cell.event([platform.tabs.on.updateIndex], function (a) {
        array.each(a, function (t) {
          assert(oUnloaded[t.id] == null)

          if (oTabs[t.id] != null) {
            send("updateIndex", set(t, dTabs))
          }
        })
      })

      cell.event([platform.tabs.on.removed], function (info) {
        log(info.windowClosing)
        var t   = info.tab
          , old = oTabs[t.id]
        if (oUnloaded[t.id]) {
          log("UNLOADING", t)
          setTimeout(function () {
            delete oUnloaded[t.id]
          }, 10000)
        } else if (old != null) {
          // TODO test this
          if (info.windowClosing) {
            // 10 seconds, so that when Chrome exits,
            // it doesn't clobber the user's data
            db.delay(["current.tabs"], 10000, function () {
              send("removed", rem(old, dTabs))
            })
          } else {
            send("removed", rem(old, dTabs))
          }
        }
      })

      cell.event([platform.tabs.on.unfocused], function (t) {
        assert(oUnloaded[t.id] == null)

        if (oTabs[t.id] != null) {
          send("unfocused", set(t, dTabs))
        }
      })

      cell.event([platform.tabs.on.focused], function (t) {
        assert(oUnloaded[t.id] == null)

        if (oTabs[t.id] != null) {
          send("focused", set(t, dTabs))
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
            assert(oTabs[value] != null)
            var x = oTabs[value]
            if (x["active"]) {
              platform.tabs.focus(value)
            } else {
              platform.tabs.open(x["url"], x["pinned"])
            }

          } else if (type === "move") {
            platform.tabs.move(value, o["index"], o["window"])

          } else if (type === "unload") {
            array.each(value, function (i) {
              var t = oTabs[i]
              var s = t["url"]
              assert(t != null)
              assert(t["active"] != null)
              var a = oActive[s]
              delete oActive[s]
              assert(a != null)
              assert(array.indexOf(a, t) !== -1)

              assert(dTabs.has(s))
              var saved = dTabs.get(s)
              saved["time"]["unloaded"] = util.time.timestamp()
              dTabs.set(s, saved)
              log(saved)
              saved = serialize.tabFromDisk(saved, s)
              assert(oTabs[saved["id"]] == null)
              send("created", (oTabs[saved["id"]] = saved))

              platform.tabs.close(array.map(a, function (x) {
                assert(x["active"] != null)
                assert(x["id"] !== saved["id"])
                assert(oTabs[x["id"]] != null)
                delete oTabs[x["id"]]
                oUnloaded[x["id"]] = true
                send("removed", x)
                return x["id"]
              }))
            })

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
