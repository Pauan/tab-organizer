goog.provide("platform.tabs")
goog.provide("platform.windows")

goog.require("util.cell")
goog.require("util.time")
goog.require("util.math")
goog.require("util.Symbol")
goog.require("util.log")
goog.require("util.array")

goog.scope(function () {
  var cell   = util.cell
    , time   = util.time
    , Symbol = util.Symbol
    , array  = util.array
    , log    = util.log.log
    , assert = util.log.assert
    , math   = util.math

  /**
   * @type {!Array.<!Win>}
   */
  var aWins = []
  var cWins = {}
  var cTabs = {}
  var ids   = {}

  var _id = Symbol("_id")

  var windows = chrome["windows"]
    , tabs    = chrome["tabs"]

  /**
   * @constructor
   */
  function Win(x) {
    this[_id]  = x["id"]
    /**
     * @type {!Array.<!Tab>}
     */
    this.tabs  = []
    this.state = x["state"]
    this.index = array.push(aWins, this)
    this.time  = {}
    this.time.created = time.timestamp()
    this.id    = this.time.created

    var self = this
    if (x["tabs"] != null) {
      array.each(x["tabs"], function (t) {
        var tab = new Tab(t, self)
        tab.id = tab.time.created = time.timestamp()
        ids[tab.id] = tab
        array.push(self.tabs, tab)
      })
    }

    cWins[this[_id]] = this
    ids[this.id] = this
  }

  // TODO handle lastFocusedTab ?
  function transfer(tab, t) {
    tab[_id]    = t["id"]
    tab.focused = t["active"]
    tab.index   = t["index"]
    tab.pinned  = t["pinned"]
    tab.url     = t["url"]   || ""
    tab.title   = t["title"] || tab.url
  }

  /**
   * @constructor
   */
  function Tab(x, win) {
    this.window = win
    this.time   = {}
    transfer(this, x)

    // TODO what if a tab is already focused ?
    if (this.focused && this.window != null) {
      this.window.lastFocusedTab = this
    }

    cTabs[this[_id]] = this
  }

  platform.tabs.on               = {}
  platform.tabs.on.created       = cell.value(undefined)
  platform.tabs.on.updated       = cell.value(undefined)
  platform.tabs.on.removed       = cell.value(undefined)
  platform.tabs.on.focused       = cell.value(undefined)
  platform.tabs.on.unfocused     = cell.value(undefined)
  platform.tabs.on.moved         = cell.value(undefined)
  platform.tabs.on.updateIndex   = cell.value(undefined)
  platform.tabs.on.windowCreated = cell.value(undefined)
  platform.tabs.on.windowRemoved = cell.value(undefined)

  platform.windows.on         = {}
  platform.windows.on.created = cell.value(undefined)
  platform.windows.on.removed = cell.value(undefined)

  platform.tabs.loaded = platform.windows.loaded = cell.dedupe(false)

  /**
   * @return {!Array.<!Tab>}
   */
  platform.tabs.getAll = function () {
    assert(platform.tabs.loaded.get(), "platform.tabs.loaded")
    var r = []
    array.each(aWins, function (x) {
      array.each(x.tabs, function (x) {
        array.push(r, x)
      })
    })
    return r
  }

  platform.windows.get = function (id) {
    return get(id)
  }

  platform.windows.getAll = function () {
    assert(platform.windows.loaded.get(), "platform.windows.loaded")
    return aWins
  }

  /**
   * @param {number} id
   * @param {!Object.<string,number>} o
   * @param {function():void=} f
   */
  function moveWindow(id, o, f) {
    windows["update"](get(id)[_id], {
      "top":    o.top,
      "left":   o.left,
      "width":  o.width,
      "height": o.height,
      "state":  "normal"
    }, function () {
      if (f != null) {
        f()
      }
    })
  }

  platform.windows.move = function (id, o) {
    moveWindow(id, o, function () {
      setTimeout(function () {
        moveWindow(id, o)
      }, 100)
    })
  }

  function get(i) {
    // TODO create two new tabs, close them, refresh the popup
    assert(i in ids)
    return ids[i]
  }

  platform.windows.maximize = function (id) {
    windows["update"](get(id)[_id], { "state": "maximized" })
  }

  /**
   * @param {!Array.<number>} a
   */
  platform.tabs.close = function (a) {
    tabs["remove"](array.map(a, function (i) {
      return get(i)[_id]
    }))
  }

  // TODO update an existing New Tab page, if it exists ?
  /**
   * @param {string} url
   * @param {boolean} pinned
   */
  platform.tabs.open = function (url, pinned, f) {
    tabs["create"]({
      "url":    url,
      "active": true,
      "pinned": !!pinned
    }, function (o) {
      log("1", o)
    })
  }

  /**
   * @param {number} i
   */
  platform.tabs.focus = function (i) {
    var tab = get(i)
    tabs["update"](tab[_id], { "active": true })
    if (tab.window != null) {
      windows["update"](tab.window[_id], { "focused": true })
    }
  }

  function updateIndices(a, iMin) {
    var r = []
    for (var i = iMin, iLen = array.len(a); i < iLen; ++i) {
      var x = a[i]
      if (x.index !== i) {
        x.index = i
        array.push(r, x)
      }
    }
    return r
  }

  function updateWindowIndices(a, iMin) {
    /*var r = */updateIndices(a, iMin)
    /*if (array.len(r)) {
      platform.windows.on.updateIndex.set(r)
    }*/
  }

  function updateTabIndices(a, iMin) {
    var r = updateIndices(a, iMin)
    if (array.len(r)) {
      platform.tabs.on.updateIndex.set(r)
    }
  }

  function updateTab(tab, t) {
    assert(tab.index === t["index"])

    delete cTabs[tab[_id]]
    transfer(tab, t)
    cTabs[tab[_id]] = tab
    tab.time.updated = time.timestamp()

    if (tab.window != null) {
      assert(tab.window[_id] === t["windowId"])
    }

    platform.tabs.on.updated.set(tab)
  }

  function focus1(tab, win) {
    win.lastFocusedTab = tab
    tab.focused = true
    tab.time.focused = time.timestamp()
    platform.tabs.on.focused.set(tab)
  }

  function focus(tab) {
    var win = tab.window
    if (win != null) {
      var old = win.lastFocusedTab
      if (old == null) {
        focus1(tab, win)
      } else if (old !== tab) {
        old.focused = false
        old.time.unfocused = time.timestamp()
        platform.tabs.on.unfocused.set(old)
        focus1(tab, win)
      }
    }
  }

  function onCreated(t) {
    log("2", t)
    var old = cTabs[t["id"]]
    if (old == null) {
      var win = cWins[t["windowId"]]
      if (win != null) {
        var tab = new Tab(t, win)
        tab.id = tab.time.created = time.timestamp()
        ids[tab.id] = tab

        array.insertAt(win.tabs, tab.index, tab)
        updateTabIndices(win.tabs, tab.index + 1)

        platform.tabs.on.created.set(tab)
      }
    } else {
      updateTab(old, t)
    }
  }

  addEventListener("load", function () {
    windows["getAll"]({ "populate": true }, function (a) {
      array.each(a, function (w) {
        if (w["type"] === "normal") {
          new Win(w)
        }
      })

      windows["onCreated"]["addListener"](function (w) {
        if (w["type"] === "normal") {
          var win = new Win(w)
          platform.windows.on.created.set(win)
        }
      })

      windows["onRemoved"]["addListener"](function (id) {
        var win = cWins[id]
        if (win != null) {
          delete cWins[id]
          delete ids[win.id]

          assert(typeof win.index === "number")
          assert(win.index >= 0)
          assert(win.index < array.len(aWins))

          array.removeAt(aWins, win.index)
          updateWindowIndices(aWins, win.index)

          win.time.removed = time.timestamp()
          platform.windows.on.removed.set(win)
        }
      })

      tabs["onCreated"]["addListener"](onCreated)
      tabs["onUpdated"]["addListener"](function (id, info, t) {
        onCreated(t)
      })

      tabs["onRemoved"]["addListener"](function (id, info) {
        var tab = cTabs[id]
        if (tab != null) {
          assert(id === tab[_id])
          delete cTabs[id]
          delete ids[tab.id]

          var win = tab.window
          if (win != null) {
            array.removeAt(win.tabs, tab.index)
            updateTabIndices(win.tabs, tab.index)
          }

          tab.time.removed = time.timestamp()
          platform.tabs.on.removed.set({
            windowClosing: info["isWindowClosing"],
            tab: tab
          })
        }
      })

      tabs["onMoved"]["addListener"](function (id, info) {
        var tab = cTabs[id]
        if (tab != null) {
          var win = tab.window
          assert(win != null)

          var oldIndex = tab.index
          tab.index = info["toIndex"]

          assert(oldIndex === info["fromIndex"])
          assert(oldIndex !== tab.index)

          array.removeAt(win.tabs, oldIndex)
          array.insertAt(win.tabs, tab.index, tab)
          updateTabIndices(win.tabs, math.min(oldIndex, tab.index + 1))

          tab.time.moved = time.timestamp()
          platform.tabs.on.moved.set(tab)
        }
      })

      // TODO what about detaching a focused tab ?
      tabs["onDetached"]["addListener"](function (id, info) {
        var tab = cTabs[id]
        if (tab != null) {
          var win = tab.window
          assert(win != null)

          delete tab.window

          assert(win[_id] === info["oldWindowId"])
          assert(tab.index === info["oldPosition"])

          array.removeAt(win.tabs, tab.index)
          updateTabIndices(win.tabs, tab.index)
        }
      })

      // TODO what about attaching a focused tab ?
      tabs["onAttached"]["addListener"](function (id, info) {
        var tab = cTabs[id]
        if (tab != null) {
          tab.index = info["newPosition"]

          var win = cWins[info["newWindowId"]]
          assert(win != null)

          assert(win[_id] === info["newWindowId"])

          tab.window = win

          array.insertAt(win.tabs, tab.index, tab)
          updateTabIndices(win.tabs, tab.index + 1)

          tab.time.moved = time.timestamp()
          platform.tabs.on.moved.set(tab)
        }
      })

      tabs["onActivated"]["addListener"](function (info) {
        var tab = cTabs[info["tabId"]]
        if (tab != null) {
          assert(tab.window != null)
          assert(tab.window[_id] === info["windowId"])
          focus(tab)
        }
      })

      tabs["onReplaced"]["addListener"](function (addedId, removedId) {
        tabs["get"](addedId, function (tab) {
          var old = cTabs[removedId]
          if (old != null) {
            assert(old[_id] !== tab["id"])
            assert(old[_id] === removedId)
            assert(tab["id"] === addedId)
            updateTab(old, tab)
          }
        })
      })

      platform.tabs.loaded.set(true)
      platform.windows.loaded.set(true)
    })
  }, true)
})
