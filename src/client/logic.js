goog.provide("logic")

goog.require("platform.manifest")
goog.require("util.Symbol")
goog.require("util.cell")
goog.require("util.array")
goog.require("util.object")
goog.require("util.url")
goog.require("util.math")
goog.require("util.dom")
goog.require("util.log")
goog.require("util.string")
goog.require("menus.tab")
goog.require("ui.menu")
goog.require("ui.group")
goog.require("ui.tab")
goog.require("ui.animate")
goog.require("ui.layout")
goog.require("tabs")
goog.require("opt")
goog.require("search")

goog.scope(function () {
  var cell     = util.cell
    , array    = util.array
    , object   = util.object
    , math     = util.math
    , url      = util.url
    , log      = util.log.log
    , assert   = util.log.assert
    , fail     = util.log.fail
    , Symbol   = util.Symbol
    , manifest = platform.manifest

  var info  = Symbol("info")
    , group = Symbol("group")

  util.dom.title(manifest.get("name"))

  var hiddenGroupList = ui.animate.object({
    //transformOrigin: "100% 50%",
    //marginTop: "5px",
    //marginLeft: "5px",
    //paddingBottom: "50px",
    //marginBottom: "50px",
    //rotationX: 0.5,
    //rotationY: 20,
    //rotationZ: -0.25,
    //height: "90%",
    //scaleY: "0.9"

    //scale: 0.98,
    "opacity": "0"
  })

  //var hiddenGroupList2 = Object.create(hiddenGroupList)
  //hiddenGroupList2.clearProps = "scale,opacity"

  var makeGroupSort = (function () {
    var second = 1000
      , minute = 60 * second
      , hour   = 60 * minute
      , day    = 24 * hour

    // TODO this whole thing should probably be in util.date
    function getDate(t1, t2) {
                    // TODO util.date
      var i1 = t1 - t1["getTimezoneOffset"]() * minute
        , i2 = t2 - t2["getTimezoneOffset"]() * minute
      i1 = math.floor(i1 / day)
      i2 = math.floor(i2 / day)
      var i = i2 - i1

      var /*year  = 0
        , month = 0
        , */days  = 0
        //, rem

      if (i === 0) {
        return "Today"
      /*} else if (i > 364) { // 1 year
        year  = Math.floor(i / 364)
        rem   = i - year * 364
        month = Math.floor(rem / 12)
        days  = rem - month * 12
      } else if (i > 30) { // 1 month
        month = Math.floor(i / 30)
        days  = i - month * 30
        //return getFullDate(t1)*/
      } else {
        days = i
      }

      /*year = (year === 0
               ? ""
               : (year === 1
                   ? year + " year "
                   : year + " years "))

      month = (month === 0
                ? ""
                : (month === 1
                    ? month + " month "
                    : month + " months "))*/


      days = (days === 0
               ? ""
               : (days === 1
                   ? days + " day "
                   : days + " days "))

      return days + "ago"
      //return year + month + days + "ago"
      /*if (t1.getFullYear() === t2.getFullYear() &&
          t1.getMonth()    === t2.getMonth()) {
      }*/
    }

    // TODO util.date
    function midnight(x) {
      var t = new Date(x)
      t["setHours"](0)
      t["setMinutes"](0)
      t["setSeconds"](0)
      t["setMilliseconds"](0)
      return +t
    }

    return function (f) {
      return {
        groupSort: function (x, y) {
          return x.id > y.id
        },
        tabSort: function (x, y) {
          return f(x[info]) >= f(y[info])
        },
        init: function (tab) {
          var id = midnight(f(tab))
          return [{
            id: id,
            // TODO update on midnight
            name: cell.dedupe(getDate(new Date(id), new Date())),
            rename: false
          }]
        }
      }
    }
  })()

  function lookup(o) {
    return function (x) {
      assert(x in o)
      return o[x]
    }
  }

  // TODO generic utility
  function setNew(o, k, f) {
    if (o[k] == null) {
      o[k] = f()
    }
    return o[k]
  }

  logic.initialize = function (e) {
    var groupSort = e.bind([opt.get("group.sort.type")], lookup({
      "window": {
        groupSort: function (x, y) {
          if (x.index === null) {
            return false
          } else if (y.index === null) {
            return true
          } else {
            return x.index <= y.index
          }
        },
        tabSort: function (x, y) {
          x = x[info]
          y = y[info]
          if (x.active && y.active) {
            return x.active.index <= y.active.index
          } else {
            return (x.time.unloaded || x.time.focused || x.time.created) >=
                   (y.time.unloaded || y.time.focused || y.time.created)
          }
        },
        init: function (tab) {
          if (tab.active == null || tab.active.window == null) {
            return [{
              id: null,
              name: cell.dedupe(""),
              index: null,
              rename: false
            }]
          } else {
            return [{
              id: tab.active.window.id,
              name: tab.active.window.name,
              index: tab.active.window.time.created,
              rename: true
            }]
          }
        }
      },
      "group": {
        groupSort: function (x, y) {
          if (x.id === "") {
            return false
          } else if (y.id === "") {
            return true
          } else {
            return x.id <= y.id
          }
        },
        // TODO should sort by time added to the group
        tabSort: function (x, y) {
          return x[info].time.created >= y[info].time.created
        },
        init: function (tab) {
          var r = []
          object.each(tab.groups, function (_, s) {
            array.push(r, {
              id: s,
              name: cell.dedupe(s),
              rename: true
            })
          })
          if (array.len(r) === 0) {
            array.push(r, {
              id: "",
              name: cell.dedupe(""),
              rename: false // TODO allow for renaming this...?
            })
          }
          return r
        }
      },
      "created": makeGroupSort(function (o) {
        return o.time.created
      }),
      "focused": makeGroupSort(function (o) {
        return o.time.focused || o.time.created
      }),
      "name": {
        groupSort: function (x, y) {
          return x.id <= y.id
        },
        tabSort: function (x, y) {
          return util.string.upper(x[info].title) <= util.string.upper(y[info].title)
        },
        init: function (tab) {
          if (tab.title === "") {
            return [{
              id: "",
              name: cell.dedupe(""),
              rename: false
            }]
          } else {
            var s = util.string.upper(tab.title[0])
            return [{
              id: s,
              name: cell.dedupe(s),
              rename: false
            }]
          }
        }
      },
      "url": {
        groupSort: function (x, y) {
          if (x.id === "chrome://") {
            return true
          } else if (y.id === "chrome://") {
            return false
          } else {
            return util.string.upper(x.id) <= util.string.upper(y.id)
          }
        },
        tabSort: function (x, y) {
          return x[info].url <= y[info].url
          // TODO pretty inefficient
          // return url.printURI(url.simplify(x.info.location)) < url.printURI(url.simplify(y.info.location))
        },
        init: function (tab) {
          var s = url.simplify(tab.location)
          var name
          if (s.scheme === "chrome") {
            name = "chrome://"
          } else {
            delete s.path
            delete s.query
            delete s.fragment
            name = url.printURI(s)
          }
          return [{
            id: name,
            name: cell.dedupe(name),
            rename: false
          }]
        }
      }
    }))

    var oGroups = {}
      , aGroups = []

    function hide(e, i, f) {
      ui.animate.to(e, i, hiddenGroupList, function () {
        e.visible.set(false)
        f()
      })
    }

    function show(e, i) {
      e.visible.set(true)
      ui.animate.from(e, i, hiddenGroupList)
    }

    function reset() {
      array.each(aGroups, function (oGroup) {
        oGroup.element.remove()
      })
      oGroups = {}
      aGroups = []
    }

    function removeTabIf(tab, f) {
      var toRemove = []
      array.each(aGroups, function (oGroup) {
        var o = oGroup.oTabs[tab.id]
        if (o != null && f(oGroup)) {
          delete oGroup.oTabs[tab.id]
          removeTabFrom(o, oGroup)

          if (array.len(oGroup.aTabs) === 0) {
            log(oGroup.id)
            delete oGroups[group.id]
            array.push(toRemove, oGroup)
            ui.group.hide(oGroup.element, 1)
          }
        }
      })
      // TODO can be slightly more efficient
      array.each(toRemove, function (oGroup) {
        array.remove(aGroups, oGroup)
      })
    }

    // TODO inefficient
    function searchTabs(f) {
      var iTabs   = 0
        , iGroups = 0

      var seen = {}

      array.each(aGroups, function (oGroup) {
        var visible = false

        array.each(oGroup.aTabs, function (x) {
          x[info].visible = (f === false || f(x[info]))
          x.visible.set(x[info].visible)
          if (x[info].visible) {
            if (!seen[x[info].id]) {
              ++iTabs
            }
            visible = true
          }
          seen[x[info].id] = true
        })

        if (visible) {
          ++iGroups
        }
        oGroup.element.visible.set(visible)
      })

      var sTabs = (iTabs === 1
                    ? iTabs + " tab"
                    : iTabs + " tabs")

      var sGroups = (iGroups === 1
                      ? iGroups + " group"
                      : iGroups + " groups")

      util.dom.title(manifest.get("name") + " - " + sTabs + " in " + sGroups)
    }

    function addGroups(e, tab, animate, f) {
      var sort = groupSort.get()
      array.each(sort.init(tab), function (o) {
        f(setNew(oGroups, o.id, function () {
          o.oTabs = {}
          o.aTabs = []
          o.element = ui.group.make(o.name, o, function (e) {
            o.tabList = e
          })

          var a     = aGroups
          var index = array.insertSorted(a, o, sort.groupSort)
          var elem  = a[index + 1]
          if (elem == null) {
            o.element.move(e)
          } else {
            o.element.moveBefore(elem)
          }

          if (animate) {
            ui.group.show(o.element, 1)
          }
          return o
        }))
      })
    }

    // TODO this whole thing dealing with selection is hacky, try and refactor it
    function deselectAllTabs(oGroup) {
      delete oGroup.previouslySelected
      var r = []
      array.each(oGroup.aTabs, function (x) {
        if (x[info].selected) {
          array.push(r, x[info])
        }
      })
      tabs.deselect(r)
    }

    function selectTab(oGroup, oTab) {
      // TODO needs to change when updating
      oGroup.previouslySelected = oTab.id
      if (!oTab.selected) {
        tabs.select([oTab])
      }
    }

    // TODO
    function tabClick(oTab, click) {
      if (click.left) {
        if (click.ctrl) {
          if (oTab.selected) {
            // TODO is this correct ?
            delete oGroup.previouslySelected
            tabs.deselect([oTab])
          } else {
            selectTab(oGroup, oTab)
          }

        } else if (click.shift) {
          if (oGroup.previouslySelected) {
            var start = false
              , aYes  = []
              , aNo   = []
            array.each(oGroup.aTabs, function (x) {
              // TODO what if previouslySelected is oTab?
              var i = x[info].id
                , b = (i === oTab.id || i === oGroup.previouslySelected)

                       // TODO inefficient
              if (b && oTab.id !== oGroup.previouslySelected) {
                start = !start
              }

              if (b || start) {
                if (!x[info].selected) {
                  array.push(aYes, x[info])
                }
              } else {
                if (x[info].selected) {
                  array.push(aNo, x[info])
                }
              }
            })
            tabs.select(aYes)
            tabs.deselect(aNo)
          } else {
            selectTab(oGroup, oTab)
          }

        // TODO behavior for this ?
        } else if (click.alt) {

        } else {
          // TODO ew
          switch (opt.get("tabs.click.type").get()) {
          case "select-focus":
            if (oTab.selected) {
              tabs.focus(oTab)
            } else {
              deselectAllTabs(oGroup)
              selectTab(oGroup, oTab)
            }
            break
          case "focus":
            if (!oTab.selected) {
              deselectAllTabs(oGroup)
            }
            // TODO unselect other tabs
            tabs.focus(oTab)
          }
        }

      } else if (click.middle) {
        tabs.close([oTab])

      } else if (click.right) {
        var a
        if (oTab.selected) {
          a = array.filter(oGroup.aTabs, function (x) {
            return x[info].selected
          })
          a = array.map(a, function (x) {
            return x[info]
          })
          assert(!!array.len(a))
          assert(array.indexOf(a, oTab) !== -1)
        } else {
          a = [oTab]
          deselectAllTabs(oGroup)
        }
        menus.tab.state.set({
          tabs: array.filter(a, function (x) {
            return x.visible
          })
        })
        ui.menu.show(menus.tab.menu, {
          left: click.mouseX + 5,
          top:  click.mouseY + 5
        })
      }
    }

    function moveTab(a, index, to) {
      var oTo = to[group]
      array.each(a, function (x) {
        var oFrom = x[group]
          , oInfo = x[info]
          , curr  = oInfo.active.index

        x[group] = oTo

        assert(oFrom.oTabs[oInfo.id] === x)
        assert(oFrom.aTabs[curr] === x)

        delete oFrom.oTabs[oInfo.id]
        assert(oTo.oTabs[oInfo.id] == null)
        oTo.oTabs[oInfo.id] = x

        array.removeAt(oFrom.aTabs, curr)
        array.insertAt(oTo.aTabs, index, x)
      })
      tabs.move(array.map(a, function (x) {
        return x[info]
      }), index + 1, oTo.id)
    }

    function makeTab(tab) {
      return ui.tab.make(tab, tabClick, moveTab)
    }


    function addTabTo(sort, tab, oGroup, animate) {
      var o = makeTab(tab)
      o[info]  = tab
      o[group] = oGroup
      oGroup.oTabs[tab.id] = o

      var a     = oGroup.aTabs
      var index = array.insertSorted(a, o, sort)
      var elem  = a[index + 1]
      if (elem == null) {
        o.move(oGroup.tabList)
      } else {
        o.moveBefore(elem)
      }

      if (animate) {
        ui.tab.show(o, 1)
      }
    }

    function removeTabFrom(tab, oGroup) {
      array.remove(oGroup.aTabs, tab)
      ui.tab.hide(tab, 1)
    }

    function addTab(e, tab, animate) {
      var sort = groupSort.get().tabSort
      addGroups(e, tab, animate, function (oGroup) {
        assert(!(tab.id in oGroup.oTabs))
        addTabTo(sort, tab, oGroup, animate)
      })
    }

    function updateTab(e, tab) {
      var sort = groupSort.get().tabSort

      var seen = {}
      addGroups(e, tab, true, function (oGroup) {
        seen[oGroup.id] = true

        var old = oGroup.oTabs[tab.id]
        if (old != null) {
          assert(old[info].id === tab.id)
          assert(old[group] === oGroup)

          var b = (old[info].url      === tab.url &&
                   !!old[info].active === !!tab.active)

          old[info] = tab

          // Doesn't move the tab, just updates in place
          if (b && array.isElementSorted(oGroup.aTabs, old, sort)) {
            ui.tab.update(old, old[info])

          // Moves the tab
          } else {
            removeTabFrom(old, oGroup)
            addTabTo(sort, tab, oGroup, true)
          }

        } else {
          // Adds the tab
          addTabTo(sort, tab, oGroup, true)
        }
      })

      removeTabIf(tab, function (oGroup) {
        return !(oGroup.id in seen)
      })
    }

    // Does not add tabs, remove tabs, or change sort order
    // Only updates existing tabs without animation
    function updateWithoutMoving(tab) {
      array.each(aGroups, function (oGroup) {
        var o = oGroup.oTabs[tab.id]
        if (o != null) {
          o[info] = tab
          ui.tab.update(o, o[info])
        }
      })
    }

    function removeTab(tab) {
      removeTabIf(tab, function () {
        return true
      })
    }

    function init() {
      object.each(tabs.all.get(), function (tab) {
        addTab(e, tab, false)
      })
      searchTabs(search.value.get(), opt.get("groups.layout").get())
    }
    init()

    e.event([groupSort], function () {
      hide(e, 0.5, function () {
        reset()
        init()
        // TODO this is here for smoother animation
        setTimeout(function () {
          show(e, 0.5)
        }, 0)
      })
    })

    ;(function () {
      function add(x) {
        addTab(e, x, true)
      }
      function update(x) {
        updateTab(e, x)
      }
      function updateRaw(x) {
        updateWithoutMoving(x)
      }
      function remove(x) {
        removeTab(x)
      }

      /*} else if (type === "windowName") {
          var sort = groupSort.get()
          array.each(aGroups, function (group) {
            group.name.set(sort.name(group))
          })*/

      e.event([tabs.on.opened], add)
      e.event([tabs.on.updated], update)
      e.event([tabs.on.moved], update)
      e.event([tabs.on.focused], update)
      e.event([tabs.on.updateIndex], updateRaw)
      e.event([tabs.on.unfocused], updateRaw)
      e.event([tabs.on.selected], updateRaw)
      e.event([tabs.on.deselected], updateRaw)
      e.event([tabs.on.closed], remove)
    })()

                                                     // TODO inefficient
    e.event([search.value, opt.get("groups.layout"), tabs.all], function (f, layout) {
      searchTabs(f, layout)
    })
  }
})
