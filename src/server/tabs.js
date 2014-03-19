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

  var popupId = platform.util.getURL("panel.html")

  var oTabs  = {}

  var oActive = {}

  var oUnloaded = {}

  function isValidURL(s) {
    return s !== "" &&
           s !== popupId
  }

  tabs.loaded = cell.dedupe(false)

  function send(type, o) {
    platform.port.message("tabs", { "type": type, "value": o })
  }

  function addActive(s, x) {
    if (oActive[s] == null) {
      oActive[s] = []
    }
    assert(array.indexOf(oActive[s], x) === -1)
    array.push(oActive[s], x)
  }

  function removeActive(s, x) {
    var a = oActive[s]
    assert(a != null)
    assert(array.indexOf(a, x) !== -1)
    array.remove(a, x)
    if (array.len(a) === 0) {
      delete oActive[s]
    }
  }

  window["getActive"] = function () {
    return oActive
  }

  function newTabFromDisk(saved, s) {
    var x = serialize.tabFromDisk(saved, s)
    assert(x["id"] === s)
    assert(oTabs[s] == null)
    oTabs[s] = x
    return x
  }

  // TODO shouldn't this call saveTab ?
  function importFromDisk(s, saved) {
    var a = oActive[s]
    if (a == null) {
      var o = oTabs[s]
      if (o == null) {
        send("created", newTabFromDisk(saved, s))
      } else {
        serialize.setFromDisk(o, saved)
        send("updated", o)
      }
    } else {
      var min = null
      array.each(a, function (x) {
        if (min === null || x["time"]["created"] < min["time"]["created"]) {
          min = x
        }
      })
      assert(min !== null)
      serialize.setFromDisk(min, saved)
      send("updated", min)
    }
  }

  tabs.fromDisk = function (oNew) {
    var l = cell.dedupe(false)
    if ("current.tabs" in oNew) {
      cell.when(cell.and(db.loaded, migrate.loaded), function () {
        var dTabs = db.open("current.tabs")
        object.each(oNew["current.tabs"], function (x, s) {
          if (dTabs.has(s)) {
            dTabs.set(s, serialize.merge(x, dTabs.get(s)))
          } else {
            dTabs.set(s, x)
          }
          importFromDisk(s, dTabs.get(s))
        })
        tabs.all.set(oTabs)
        l.set(true)
      })
    } else {
      l.set(true)
    }
    return l
  }

  tabs.all = cell.value(oTabs)

  tabs.getAll = function () {
    assert(tabs.loaded.get())
    return oTabs
  }

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

    window["delTab"] = function (s) {
      dTabs.del(s)
    }

    function removeActiveAndSave(s, o) {
      removeActive(s, o)
      if (oActive[s] == null) {
        assert(dTabs.has(s))
        dTabs.del(s)
      }
    }

    function updateTab(o, t) {
      assert(oUnloaded[t.id] == null)
      assert(oTabs[t.id] != null)
      assert(o["type"] === "active")

      assert(!!o["url"])
      assert(!!t.url)
      if (o["url"] !== t.url) {
        assert(typeof o["url"] === "string")
        assert(typeof t.url === "string")
        addActive(t.url, o)
        // TODO I don't like how removeActive saves but addActive doesn't
        removeActiveAndSave(o["url"], o)
        o["url"] = t.url
      }

      o["title"]        = t.title
      o["pinned"]       = t.pinned
      o["index"]        = t.index
      o["window"]["id"] = t.window.id
      o["focused"]      = t.focused

      tabs.all.set(oTabs)
      return o
    }

    function saveTab(o) {
      assert(!!o["url"])
      var a = oActive[o["url"]]
      if (a == null) {
        assert(o["type"] === "unloaded")
        assert(dTabs.has(o["url"]))
        var saved = dTabs.get(o["url"])
        assert(saved["time"]["created"] === o["time"]["created"])
        assert(saved["time"]["updated"] === o["time"]["updated"])
        assert(saved["time"]["focused"] === o["time"]["focused"])
        assert(saved["time"]["unloaded"] === o["time"]["unloaded"])
        assert(saved["groups"] === o["groups"])
        assert(saved["title"] === o["title"])
        log(o, saved)
        dTabs.set(o["url"], serialize.tabToDisk(o))
      } else {
        assert(o["type"] === "active")
        if (array.len(a) === 1) {
          assert(a[0] === o)
          assert(o["groups"] != null, o["url"])
          dTabs.set(o["url"], serialize.tabToDisk(o))
        } else {
          assert(array.indexOf(a, o) !== -1)
          dTabs.set(o["url"], array.foldl1(a, serialize.merge))
        }
      }
      return o
    }

    // TODO I don't like that this needs to be run after saveTab
    function closeDuplicates(o) {
      var a = oActive[o["url"]]
      assert(a != null)
      if (array.len(a) > 1 && opt.get("tabs.close.duplicates").get()) {
        assert(dTabs.has(o["url"]))
        assert(oTabs[o["url"]] == null)
        var saved = dTabs.get(o["url"])
        serialize.setFromDisk(o, saved)

        var aClose = array.filter(a, function (x) {
          return x !== o
        })
        assert(array.len(aClose) === array.len(a) - 1)
        assert(array.len(aClose) >= 1)
        platform.tabs.close(array.map(aClose, function (x) {
          assert(x["url"] === o["url"])
          assert(x["type"] === "active")
          assert(x["id"] !== o["id"])
          assert(o["time"]["created"] <= x["time"]["created"])
          return x["id"]
        }))
      }
      return o
    }

    function newTab(t) {
      assert(oUnloaded[t.id] == null)
      assert(oTabs[t.id] == null)

      var o = {
        "type": "active",
        "id": t.id,
        "url": t.url,
        "groups": {},
        "time": {
          "created": time.timestamp()
        },
        "window": {}
      }
      oTabs[t.id] = o

      if (dTabs.has(t.url) && oActive[t.url] == null) {
        assert(oTabs[t.url] != null)
        assert(t.url === o["url"])
        // shouldn't this use oTabs[t.url] instead of dTabs.get(t.url) ?
        var saved = dTabs.get(t.url)
        send("removed", oTabs[t.url])
        delete oTabs[t.url]
        serialize.setFromDisk(o, saved)
      }

      addActive(t.url, o)
      return updateTab(o, t)
    }

    function unloadTab(o) {
      assert(oUnloaded[o["id"]] == null)
      assert(oTabs[o["id"]] != null)
      assert(o["type"] === "active")

      delete oTabs[o["id"]]
      oUnloaded[o["id"]] = true

      assert(oActive[o["url"]] == null)

      return o
    }

    // TODO this should call saveTab or something ?
    function removeTab(o) {
      assert(oUnloaded[o["id"]] == null)
      assert(oTabs[o["id"]] != null)
      assert(o["type"] === "active")

      delete oTabs[o["id"]]

      removeActiveAndSave(o["url"], o)

      tabs.all.set(oTabs)

      return o
    }

    function closeUnloadedTab(o) {
      assert(oUnloaded[o["id"]] == null)
      assert(o["url"] === o["id"])
      assert(oTabs[o["url"]] === o)
      assert(oTabs[o["id"]] != null)
      assert(o["type"] === "unloaded")
      assert(oActive[o["url"]] == null)

      delete oTabs[o["id"]]
      dTabs.del(o["url"])

      return o
    }

    function updateAndSend(s, t) {
      assert(oUnloaded[t.id] == null)

      var old = oTabs[t.id]
      if (old != null) {
        send(s, updateTab(old, t))
      }
    }

    object.each(dTabs.getAll(), function (x, s) {
      newTabFromDisk(x, s)
    })

    array.each(platform.tabs.getAll(), function (t) {
      assert(oUnloaded[t.id] == null)

      if (isValidURL(t.url)) {
        saveTab(newTab(t))
      } else {
        assert(oTabs[t.id] == null)
      }
    })

    function onCreated(t) {
      assert(oUnloaded[t.id] == null)

      var old = oTabs[t.id]
      if (isValidURL(t.url)) {
        if (old == null) {
          send("created", closeDuplicates(saveTab(newTab(t))))
        } else {
          old["time"]["updated"] = time.timestamp()
          send("updated", closeDuplicates(saveTab(updateTab(old, t))))
        }
      } else if (old != null) {
        // TODO maybe it should keep the stuff like time created, updated, etc. ?
        send("removed", removeTab(old))
      }
    }
    cell.event([platform.tabs.on.created], onCreated)
    cell.event([platform.tabs.on.updated], onCreated)

    cell.event([platform.tabs.on.focused], function (t) {
      assert(oUnloaded[t.id] == null)

      var old = oTabs[t.id]
      if (old != null) {
        old["time"]["focused"] = time.timestamp()
        send("focused", saveTab(updateTab(old, t)))
      }
    })

    cell.event([platform.tabs.on.unfocused], function (t) {
      if (oUnloaded[t.id] == null) {
        updateAndSend("unfocused", t)
      }
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
        setTimeout(function () {
          delete oUnloaded[t.id]
        }, 10000)

      } else if (old != null) {
        // TODO test this
        if (info.windowClosing) {
          // 10 seconds, so that when Chrome exits,
          // it doesn't clobber the user's data
          db.delay(["current.tabs"], 10000, function () {
            send("removed", removeTab(old))
          })
        } else {
          send("removed", removeTab(old))
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
            } else if (x["type"] === "unloaded") {
              assert(x["id"] === value)
              assert(x["url"] === value)
              send("removed", closeUnloadedTab(x))
              return false
            } else {
              fail()
              return false
            }
          }))
          tabs.all.set(oTabs)

        } else if (op === "focus") {
          assert(oTabs[value] != null)
          var x = oTabs[value]
          assert(value === x["id"])
          if (x["type"] === "active") {
            platform.tabs.focus(value)
          } else if (x["type"] === "unloaded") {
            platform.tabs.open(x["url"], x["pinned"])
          } else {
            fail()
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
            assert(t != null)
            assert(t["type"] === "active")

            var s = t["url"]
            assert(dTabs.has(s))
            var saved = dTabs.get(s)
            saved["time"]["unloaded"] = time.timestamp()
            dTabs.set(s, saved)
            send("created", newTabFromDisk(saved, s))

            var a = oActive[s]
            delete oActive[s]
            assert(a != null)
            assert(array.indexOf(a, t) !== -1)

            platform.tabs.close(array.map(a, function (x) {
              assert(x["id"] !== saved["id"])
              send("removed", unloadTab(x))
              return x["id"]
            }))
          })
          tabs.all.set(oTabs)

        } else if (op === "addToGroup") {
          var s = o["group"]
          assert(typeof s === "string")
          var timestamp = time.timestamp()
          array.each(value, function (i) {
            var t = oTabs[i]
            assert(t != null)
            if (t["groups"][s] == null) {
              t["groups"][s] = timestamp
              send("updated", saveTab(t))
            }
          })
          tabs.all.set(oTabs)

        } else if (op === "removeFromGroup") {
          var s = o["group"]
          assert(typeof s === "string")
          array.each(value, function (i) {
            var t = oTabs[i]
            assert(t != null)
            if (t["groups"][s] != null) {
              delete t["groups"][s]
              send("updated", saveTab(t))
            }
          })
          tabs.all.set(oTabs)

        } else if (op === "window-rename") {
          renameWin(platform.windows.get(o["id"]), value)

        } else {
          fail()
        }
      })
    })

    tabs.loaded.set(true)
  })
})
