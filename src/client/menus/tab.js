goog.provide("menus.tab")

goog.require("util.cell")
goog.require("util.array")
goog.require("util.object")
goog.require("util.log")
goog.require("ui.animate")
goog.require("ui.menu")
goog.require("tabs")
goog.require("groups")

goog.scope(function () {
  var cell   = util.cell
    , array  = util.array
    , object = util.object
    , assert = util.log.assert
    , log    = util.log.log

  menus.tab.state = cell.value({ tabs: [] })

  // TODO remove this later, maybe?
  cell.event([menus.tab.state], function (state) {
    assert(!!array.len(state.tabs))
    assert(state.name == null)
  })

  function getIds() {
    var a = menus.tab.state.get().tabs
    assert(!!array.len(a))
    return a
  }

  menus.tab.menu = ui.menu.make(function (o) {
    var groupMenu = ui.menu.make(function (o) {
      ui.menu.item(o, function (o) {
        o.text("New")

        o.event([o.activate], function () {
          var s = prompt("Please enter a name for the group", "")
          while (s === "") {
            s = prompt("Name cannot be empty", "")
          }
          log(s)
          if (s !== null) {
            tabs.addToGroup(s, getIds())
          }
          ui.menu.hide() // TODO I'd like to get rid of this
        })
      })

      ui.menu.separator(o, function (eSeparator) {
        eSeparator.hide()

        var aGroups = []
          , oGroups = {}

        var iAnim = 0.5

        var animHidden = ui.animate.object({
          "width": "0px",
          "height": "0px",
          "padding": "0px",
          "margin": "0px",
          "borderWidth": "0px",
          "opacity": "0"
        })

        function sort(x, y) {
          // TODO can probably just use < rather than localeCompare
          return x["toLocaleUpperCase"]()["localeCompare"](y["toLocaleUpperCase"]()) < 0
        }

        function showSeparator(bAnimate) {
          eSeparator.show()
          if (bAnimate) {
            ui.animate.from(eSeparator, iAnim, animHidden)
          }
        }

        function hideSeparator() {
          ui.animate.to(eSeparator, iAnim, animHidden, function () {
            eSeparator.hide()
          })
        }

        function makeCheckbox(s, bAnimate) {
          assert(oGroups[s] == null)

          ui.menu.checkbox(o, function (o) {
            oGroups[s] = o

            var i = array.insertSorted(aGroups, s, sort)

            function hasGroup(x) {
              return x.groups[s] != null
            }

            o.bind([menus.tab.state], function (state) {
              var a = array.filter(state.tabs, hasGroup)
              if (array.len(a) === array.len(state.tabs)) {
                o.checked.set(true)
              } else if (array.len(a) === 0) {
                o.checked.set(false)
              } else {
                o.checked.set(null)
              }
            })

            o.event([o.activate], function (b) {
              if (b) {
                tabs.addToGroup(s, getIds())
              } else {
                tabs.removeFromGroup(s, getIds())
              }
            })

            o.text(s)

            i = aGroups[i + 1]
            if (i != null) {
              i = oGroups[i]
            }
            o.moveBefore(i)

            showSeparator(bAnimate)
            //o.show(iAnim, animate)
            if (bAnimate) {
              ui.animate.from(o, iAnim, animHidden)
            }
          })
        }

        function removeCheckbox(s) {
          var e = oGroups[s]
          assert(e != null)
          delete oGroups[s]
          array.remove(aGroups, s)

          if (!array.len(aGroups)) {
            hideSeparator()
          }

          //e.remove(iAnim, animate)

          ui.animate.to(e, iAnim, animHidden, function () {
            e.remove()
          })
        }

        cell.when(groups.loaded, function () {
          object.each(groups.getAll(), function (_, s) {
            makeCheckbox(s, false)
          })

          o.event([groups.on.added], function (s) {
            makeCheckbox(s, true)
          })

          o.event([groups.on.removed], function (s) {
            removeCheckbox(s)
          })
        })
      })
    })

    ui.menu.item(o, function (o) {
      o.text("Unload")

      function isActive(x) {
        return x.active
      }

      o.bind([menus.tab.state], function (state) {
        if (array.some(state.tabs, isActive)) {
          o.enabled.set(true)
        } else {
          o.enabled.set(false)
        }
      })

      o.event([o.activate], function () {
        tabs.unload(getIds())
        ui.menu.hide()
      })
    })

    ui.menu.item(o, function (o) {
      o.text("Close")

      o.event([o.activate], function () {
        tabs.close(getIds())
        ui.menu.hide()
      })
    })

    ui.menu.separator(o)

    ui.menu.submenu(o, groupMenu, function (o) {
      o.text("Group...")
    })
  })
})
