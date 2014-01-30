goog.provide("panel")

goog.require("util.dom")
goog.require("util.cell")
goog.require("util.array")
goog.require("ui.menu")
goog.require("ui.tabs")
goog.require("ui.urlBar")
goog.require("ui.common")
goog.require("ui.layout")
goog.require("menus.global")
goog.require("menus.button")
goog.require("opt")
goog.require("cache")
goog.require("search")
goog.require("logic")
//goog.require("groups")

goog.scope(function () {
  var ui    = util.ui
    , cell  = util.cell
    , array = util.array

  var searchHeight = 23

  ui.normalize(function (e) {
    e.stopDragging()

    //e.clip()

    /*e.width("100%")
    e.height("100%")*/

    // TODO it might not need to wait for "tab.loaded" until after
    cell.when(cell.and(cache.loaded, opt.loaded, tabs.loaded, groups.loaded), function () {
      menu.initialize(e)
      urlBar.initialize(e)

      var body = ui.style(function (e) {
        e.set("font-family", "sans-serif")
        e.set("font-size", "13px")

        // TODO test this
        cell.bind([opt.get("popup.type"),
                   opt.get("size.bubble.width"),
                   opt.get("size.bubble.height")], function (type, width, height) {
          // TODO seems unreliable
          if (type === "bubble" && (window["outerWidth"] < (width / 2) || window["outerHeight"] < (height / 2))) {
            e.set("width",  width  + "px")
            e.set("height", height + "px")
          } else {
            e.set("width",  "")
            e.set("height", "")
          }
        })
      })

      var top = ui.style(function (e) {
        e.styles(ui.horiz)
        e.set("height", searchHeight + "px")
        e.set("border-width", "2px")
        e.set("border-radius", "5px")
        e.set("background-color", ui.hsl(0, 0, 100, 1))
        e.set("z-index", "3")
      })

      var topRight = ui.style(function (e) {
        e.styles(ui.horiz)
        e.set("padding-right", "3px")
      })

      var topSeparator = ui.style(function (e) {
        e.set("border-left-width", "3px")
        e.set("border-left-style", "double")
        e.set("height", "14px")
        e.set(["margin-top", "margin-bottom"], "2px")
        e.set(["margin-right", "margin-bottom"], "3px")
      })

      var topMenuText = ui.style(function (e) {})

      var bottom = ui.style(function (e) {
        e.set("white-space", "pre")
        e.set("overflow", "auto")
        //e.marginTop = "1px"
        e.set("width", "100%")
        e.set("height", ui.calc("100%", "-", searchHeight + "px"))
      })

      e.styles(body, common.background)

      ui.box(function (e) {
        e.styles(top, common.topBar)

        search.initialize(e)

        ui.box(function (e) {
          e.styles(topRight)

          ui.box(function (e) {
            e.styles(topSeparator, common.topSeparator)
          }).move(e)

          ui.box(function (e) {
            e.styles(topMenuText)
            e.text("Menu")
          }).move(e)

          menus.button.initialize(e, menus.global.menu, function () {
            var normal   = []
              , selected = []
            array.each(tabs.getAll(), function (x) {
              if (x.isVisible) {
                if (x.selected) {
                  selected.push(x)
                } else {
                  normal.push(x)
                }
              }
            })
            menus.global.state.set({ normal: normal, selected: selected })
          })
        }).move(e)

        //menu_button_ui.make(all_menu_ui.get(), ).move(e)
      }).move(e)

      // TODO try making this vert and stretch
      ui.box(function (e) {
        e.styles(bottom)
        //e.stretch()

        e.bind([opt.get("groups.layout")], function (x) {
          e.styleObject(layout.groupList, x, true)
        })

        logic.initialize(e)

        /*function run(f) {
          var r = []
            , i = 1000

          while (i--) {
            ;(function () {
              var o =
              r.push(tab_ui.add(e, o))

              setTimeout(function () {
                o.active.set(false)
              }, 10000)
            })()
          }

          setTimeout(function () {
            r.forEach(function (e) {
              e.remove()
            })

            r = []

            setTimeout(function () {
              f()
            }, 10000)
          }, 20000)
        }

        run(function () {
          run(function () {
            run(function () {})
          })
        })*/
      }).move(e)
    })
  })
})
