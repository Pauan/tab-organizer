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
    , time   = util.time
    , db     = platform.db

  var popupId = platform.util.getURL("../panel.html")

  var oTabs  = {}
  var oSaved = {}

  var oActive = {}

  var oUnloaded = {}

  function isValidURL(s) {
    return s !== "" &&
           s !== popupId// &&
           //s !== "chrome://newtab/"
  }

  tabs.loaded = cell.dedupe(false)

  function send(type, o) {
    platform.port.message("tabs", { "type": type, "value": o })
  }

  function addActive(x) {
    if (oActive[x.url] == null) {
      oActive[x.url] = []
    }
    array.push(oActive[x.url], x)
  }

  function removeActive(x) {
    var a = oActive[x.url]
    assert(a != null)
    assert(array.indexOf(a, x) !== -1)
    array.remove(a, x)
    if (array.len(a) === 0) {
      delete oActive[x.url]
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
        var o = {
          "id": win.id,
          "name": getWindowName(win),
          "time": {
            "created": time.timestamp()
          }
        }
        oWins[win.id] = o
        return o
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
        assert(win.id in oWins)

        var old = oWins[win.id]

        if (old["name"] !== name) {
          var a = aNames.get()
          if (name === getDefaultName(win)) {
            a[win.index] = null
            array.resize(a, getLength(a))
          } else {
            a[win.index] = name
          }

          // TODO is this necessary...?
          aNames.set(array.map(a, function (x) {
            if (x == null) {
              return null
            } else {
              return x
            }
          }))

          old["name"] = name
          platform.port.message("tabs", {
            "type": "window-renamed",
            "value": old
          })
        }
      }

      array.each(platform.windows.getAll(), function (win) {
        addWin(win)
      })

      cell.event([platform.windows.on.created], function (win) {
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

        // TODO platform.windows.on.updateIndex ?
        array.each(platform.windows.getAll(), function (win) {
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

      /*function set(t, dTabs) {
        var o = serialize.tab(t)

        if (dTabs.has(o["url"]) && oActive[o["url"]] == null) {
          var saved = dTabs.get(o["url"])
          // TODO
          //assert(saved["time"]["created"] !== o["time"]["created"])
          //assert(saved["time"]["created"] !== o["id"])
          //assert(oTabs[saved["time"]["created"]] != null)
          //send("removed", oTabs[saved["time"]["created"]])
          //delete oTabs[saved["time"]["created"]]
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
      }*/

      function updateTab(o, t) {
        assert(oUnloaded[t.id] == null)
        assert(oTabs[t.id] != null)
        assert(o["type"] === "active")

        o["url"]          = t.url
        o["title"]        = t.title
        o["pinned"]       = t.pinned
        o["index"]        = t.index
        o["window"]["id"] = t.window.id
        o["focused"]      = t.focused
        return o
      }

      function newTab(t) {
        assert(oUnloaded[t.id] == null)
        assert(oTabs[t.id] == null)

        var o = {
          "type": "active",
          "id": t.id,
          "groups": {},
          "time": {
            "created": time.timestamp()
          },
          "window": {}
        }

        oTabs[t.id] = o
        return updateTab(o, t)
      }

      function updateAndSend(s, t) {
        assert(oUnloaded[t.id] == null)

        var old = oTabs[t.id]
        if (old != null) {
          send(s, updateTab(old, t))
        }
      }

      function removeTabAndSave(o) {
        assert(oUnloaded[o["id"]] == null)
        assert(oTabs[o["id"]] != null)
        assert(o["type"] === "active")
        delete oTabs[o["id"]]
        return o
      }

      /*object.each(dTabs.getAll(), function (x, s) {
        x = serialize.tabFromDisk(x, s)
        oTabs[x["id"]] = x
      })*/

      array.each(platform.tabs.getAll(), function (t) {
        assert(oUnloaded[t.id] == null)

        if (isValidURL(t.url)) {
          newTab(t)
        // TODO is this correct ?
        } else {
          delete oTabs[t.id]
        }
      })

      // TODO maybe this should do nothing if the URL is ""
      function onCreated(t) {
        assert(oUnloaded[t.id] == null)

        var old = oTabs[t.id]
        if (isValidURL(t.url)) {
          if (old == null) {
            send("created", newTab(t))
          } else {
            old["time"]["updated"] = time.timestamp()
            send("updated", updateTab(old, t))
          }
        // TODO test this
        } else if (old != null) {
          assert(false, "REMOVING " + old.url + " " + t.url)
          send("removed", removeTabAndSave(old))
        }
      }
      cell.event([platform.tabs.on.created], onCreated)
      cell.event([platform.tabs.on.updated], onCreated)

      cell.event([platform.tabs.on.focused], function (t) {
        var old = oTabs[t.id]
        if (old != null) {
          old["time"]["focused"] = time.timestamp()
        }
        updateAndSend("focused", t)
      })

      cell.event([platform.tabs.on.unfocused], function (t) {
        updateAndSend("unfocused", t)
      })

      cell.event([platform.tabs.on.moved], function (t) {
        updateAndSend("moved", t)
      })

      cell.event([platform.tabs.on.updateIndex], function (a) {
        array.each(a, function (t) {
          updateAndSend("updateIndex", t)
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
              send("removed", removeTabAndSave(old))
            })
          } else {
            send("removed", removeTabAndSave(old))
          }
        }
      })

      cell.event([platform.port.on.connect("tabs")], function (port) {
        log("CONNECT", oTabs)
        port.message({ "tabs": oTabs, "windows": oWins })
      })

      cell.event([platform.port.on.message("tabs")], function (a) {
        array.each(a, function (o) {
          var op    = o["type"]
            , value = o["value"]

          if (op === "close") {
            platform.tabs.close(array.filter(value, function (value) {
              assert(oTabs[value] != null)
              var x = oTabs[value]
              if (x["type"] === "active") {
                assert(value === x["id"])
                return true
              } else {
                // TODO
                return false
              }
            }))

          } else if (op === "focus") {
            assert(oTabs[value] != null)
            var x = oTabs[value]
            if (x["type"] === "active") {
              assert(value === x["id"])
              platform.tabs.focus(value)
            } else {
              platform.tabs.open(x["url"], x["pinned"])
            }

          } else if (op === "move") {
            array.each(value, function (value) {
              assert(oTabs[value] != null)
              assert(oTabs[value]["type"] === "active")
            })
            platform.tabs.move(value, o["index"], o["window"])

          } else if (op === "unload") {
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
              saved["time"]["unloaded"] = time.timestamp()
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

          } else if (op === "window-rename") {
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
