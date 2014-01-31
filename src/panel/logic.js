goog.provide("logic")

goog.require("platform.manifest")
goog.require("util.cell")
goog.require("util.array")
goog.require("util.object")
goog.require("util.url")
goog.require("util.math")
goog.require("util.dom")
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
    , manifest = platform.manifest

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
    "opacity": "0",
  })

  //var hiddenGroupList2 = Object.create(hiddenGroupList)
  //hiddenGroupList2.clearProps = "scale,opacity"

  var makeGroupSort = (function () {
    var second = 1000
      , minute = 60 * second
      , hour   = 60 * minute
      , day    = 24 * hour

    function getDate(t1, t2) {
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
        hide: false,
        rename: false,
        groupSort: function (x, y) {
          return x.id > y.id
        },
        tabSort: function (x, y) {
          return f(x.info) > f(y.info)
        },
        id: function (tab) {
          return [{
            id: midnight(f(tab))
          }]
        },
        name: function (x) {
          return getDate(new Date(x.id), new Date())
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

  function moveElement(e, a, o, index) {
    var x = a[index + 1]
    o.element.moveBefore(e, x && x.element)
  }

  function insertElement(e, a, o, sort) {
    moveElement(e, a, o, array.insertSorted(a, o, sort))
  }

  // TODO generic utility
  function setNew(o, k, f) {
    if (o[k] == null) {
      o[k] = f()
    }
    return o[k]
  }

  function removeElement(x) {
    if (x != null) {
      ui.tab.hide(x, 1)
    }
  }

  exports.initialize = function (e) {
    var groupSort = e.bind([opt.get("group.sort.type")], lookup({
      "window": {
        groupSort: function (x, y) {
          if (x.id === null) {
            return false
          } else if (y.id === null) {
            return true
          } else {
            return x.id < y.id
          }
        },
        tabSort: function (x, y) {
          x = x.info
          y = y.info
          if (x.active && y.active) {
            return x.active.index < y.active.index
          } else {
            return (x.time.unloaded || x.time.focused || x.time.created) >
                   (y.time.unloaded || y.time.focused || y.time.created)
          }
        },
        id: function (tab) {
          if (tab.active == null || tab.active.window == null) {
            return [{
              id: null,
              window: {
                name: ""
              }
            }]
          } else {
            return [{
              id: tab.active.window.timestamp,
              window: {
                name: tab.active.window.name
              }
            }]
          }
        },
        name: function (x) {
          return x.window.name
        }
      },
      "group": {
        groupSort: function (x, y) {
          if (x.id === "") {
            return false
          } else if (y.id === "") {
            return true
          } else {
            return x.id < y.id
          }
        },
        // TODO should sort by time added to the group
        tabSort: function (x, y) {
          return x.info.time.created > y.info.time.created
        },
        id: function (tab) {
          var r = []
          object.each(tab.groups, function (_, s) {
            array.push(r, { id: s })
          })
          if (array.len(r) === 0) {
            array.push(r, { id: "" })
          }
          return r
        },
        name: function (x) {
          return (x.id === "" ? " " : x.id)
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
          return x.id < y.id
        },
        tabSort: function (x, y) {
          return x.info.title["toLocaleUpperCase"]() < y.info.title["toLocaleUpperCase"]()
        },
        id: function (tab) {
          if (tab.title === "") {
            return [{ id: "" }]
          } else {
            var s = tab.title[0]["toLocaleUpperCase"]()
            return [{ id: s }]
          }
        },
        name: function (x) {
          return x.id
        }
      },
      "url": {
        groupSort: function (x, y) {
          return x.id < y.id
        },
        tabSort: function (x, y) {
          return x.info.url < y.info.url
          // TODO pretty inefficient
          // return url.printURI(url.simplify(x.info.location)) < url.printURI(url.simplify(y.info.location))
        },
        id: function (tab) {
          var s = url.simplify(tab.location)
          if (s.scheme === "chrome") {
            // TODO should always be sorted first
            return [{
              id: "Chrome"
            }]
          } else {
            delete s.path
            delete s.query
            delete s.fragment
            return [{
              id: url.printURI(s)
            }]
          }
        },
        name: function (x) {
          return x.id
        }
      }
    }))

    var oGroups = {}
      , aGroups = []

    function hide(e, i, f) {
      ui.animate.to(e, i, hiddenGroupList, function () {
        e.hide()
        f()
      })
    }

    function show(e, i) {
      e.show()
      ui.animate.from(e, i, hiddenGroupList)
    }

    function reset() {
      array.each(aGroups, function (group) {
        group.element.remove()
      })
      oGroups = {}
      aGroups = []
    }

    function removeTabIf(tab, f) {
      var toRemove = []
      array.each(aGroups, function (group) {
        var o = group.oTabs[tab.id]
        if (o != null && f(group)) {
          delete group.oTabs[tab.id]
          array.remove(group.aTabs, o)
          ui.tab.hide(o.element, 1)

          if (array.len(group.aTabs) === 0) {
            log(group.id)
            delete oGroups[group.id]
            array.push(toRemove, group)
            ui.group.hide(group.element, 1)
          }
        }
      })
      // TODO can be slightly more efficient
      array.each(toRemove, function (group) {
        array.remove(aGroups, group)
      })
    }

    function searchTabs(f, layout) {
      var iTabs = 0
        , iGroups = 0

      var seen = {}

      var last = null

      array.each(aGroups, function (group) {
        group.element.hide()
        array.each(group.aTabs, function (tab) {
          if (f.value == null || f.value(tab)) {
            if (!(tab.info.id in seen)) {
              ++iTabs
            }
            if (group.element.isHidden()) {
              ++iGroups
              group.element.show()

              if (last !== null) {
                last.styleObject(ui.layout.groupLast, layout, false)
              }
              last = group.element
              last.styleObject(ui.layout.groupLast, layout, true)
            }
            // TODO is this correct ?
            tab.info.isVisible = true
            tab.element.show()
          } else {
            delete tab.info.isVisible
            tab.element.hide()
          }
          seen[tab.info.id] = true
        })
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
      array.each(sort.id(tab), function (o) {
        f(setNew(oGroups, o.id, function () {
          o.name    = cell.dedupe(sort.name(o))
          o.oTabs   = {}
          o.aTabs   = []
          o.element = ui.group.make(o.name, o, function (e) {
            o.tabList = e
          })
          insertElement(e, aGroups, o, sort.groupSort)
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
        if (x.info.selected) {
          array.push(r, x.info)
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

    function tabClick(oTab, oGroup, click) {
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
              var i = x.info.id
                , b = (i === oTab.id || i === oGroup.previouslySelected)

                       // TODO inefficient
              if (b && oTab.id !== oGroup.previouslySelected) {
                start = !start
              }

              if (b || start) {
                if (!x.info.selected) {
                  array.push(aYes, x.info)
                }
              } else {
                if (x.info.selected) {
                  array.push(aNo, x.info)
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
            return x.info.selected
          })
          a = array.map(a, function (x) {
            return x.info
          })
          assert(array.len(a))
          assert(array.indexOf(a, oTab) !== -1)
        } else {
          a = [oTab]
          deselectAllTabs(oGroup)
        }
        menus.tab.state.set({
          tabs: array.filter(a, function (x) {
            return x.isVisible
          })
        })
        menu.show(menus.tab.menu, {
          left: click.mouseX + 5,
          top:  click.mouseY + 5
        })
      }
    }

    function makeTab(tab, group) {
      return ui.tab.make(tab, group, tabClick)
    }


    function addTab(e, tab, animate) {
      var sort = groupSort.get().tabSort
      addGroups(e, tab, animate, function (group) {
        setNew(group.oTabs, tab.id, function () {
          var o = {
            info: tab,
            element: makeTab(tab, group)
          }
          insertElement(group.tabList, group.aTabs, o, sort)
          if (animate) {
            ui.tab.show(o.element, 1)
          }
          return o
        })
      })
    }

    function updateTab(e, tab, animate) {
      var sort = groupSort.get().tabSort

      var seen = {}
      addGroups(e, tab, animate, function (group) {
        seen[group.id] = true

        var o = setNew(group.oTabs, tab.id, function () {
          return {}
        })

        var old = o.element

        var b = (old             != null &&
                 o.info          != null &&
                 o.info.url      === tab.url &&
                 !!o.info.active === !!tab.active)

        o.info = tab

        if (b && array.isElementSorted(group.aTabs, o, sort)) {
          ui.tab.update(old, o.info)
        } else {
          o.element = makeTab(o.info, group)
          // TODO inefficient
          array.remove(group.aTabs, o)
          insertElement(group.tabList, group.aTabs, o, sort)
          removeElement(old)
          if (animate) {
            ui.tab.show(o.element, 1)
          }
        }
      })
      removeTabIf(tab, function (group) {
        return !(group.id in seen)
      })
    }

    // Does not add tabs, remove tabs, or change sort order
    // Only updates existing tabs without animation
    function updateWithoutMoving(tab) {
      array.each(aGroups, function (group) {
        var o = group.oTabs[tab.id]
        if (o != null) {
          assert(o.element != null)
          o.info = tab
          ui.tab.update(o.element, o.info)
        }
      })
    }

    function removeTab(tab) {
      removeTabIf(tab, function () {
        return true
      })
    }

    function init() {
      array.each(tab.getAll(), function (tab) {
        addTab(e, tab, false)
      })
      searchTabs(search.on.get(), opt.get("groups.layout").get())
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

    e.event([tab.on], function (a) {
      array.each(a, function (o) {
        var type = o["type"]
          , x    = o["value"]
        if (type === "created") {
          addTab(e, x, true)
        } else if (type === "updated" || type === "moved" || type === "focused") {
          updateTab(e, x, true)
        } else if (type === "updateIndex" || type === "unfocused") {
          updateWithoutMoving(x)
        } else if (type === "removed") {
          removeTab(x)
        /*} else if (type === "midnight") {
          var sort = groupSort.get()
          array.each(aGroups, function (group) {
            group.name.set(sort.name(group))
          })*/
        } else {
          fail()
        }
      })
      searchTabs(search.on.get(), opt.get("groups.layout").get())
    })

    e.event([search.on, opt.get("groups.layout")], function (f, layout) {
      searchTabs(f, layout)
    })
  }
})
