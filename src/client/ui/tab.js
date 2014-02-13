goog.provide("ui.tab")

goog.require("util.Symbol")
goog.require("util.dom")
goog.require("util.array")
goog.require("util.log")
goog.require("util.cell")
goog.require("ui.urlBar")
goog.require("ui.common")
goog.require("ui.animate")
goog.require("tabs")
goog.require("opt")

goog.scope(function () {
  var Symbol = util.Symbol
    , dom    = util.dom
    , array  = util.array
    , log    = util.log.log
    , cell   = util.cell

  var info = Symbol("info")

  var hiddenTab = ui.animate.object({
    //transform: "scale(0)",
    //scaleY: "0",

    "borderTopWidth": "0px",
    "borderBottomWidth": "0px",
    "paddingTop": "0px",
    "paddingBottom": "0px",

    //marginLeft: "15px",
    "height": "0px",
    "opacity": "0"
  })

  var tabStyle = dom.style(function (e) {
    e.styles(dom.horiz, dom.clip, ui.common.normal)
    e.set("border-width", "1px")
    e.set("padding", "1px")
    e.set("height", "20px")
    e.set("border-radius", "5px")
  })

  var tabHoverStyle = dom.style(function (e) {
    e.set("font-weight", "bold")
  })

  var tabClickStyle = dom.style(function (e) {
    e.set("padding-top", "2px")
    e.set("padding-bottom", "0px")
  })

  var tabInactiveStyle = dom.style(function (e) {
    e.set("color", dom.hsl(0, 0, 30))
    e.set("opacity", "0.75")
  })

  var tabInactiveHoverStyle = dom.style(function (e) {
    e.set("background-color", dom.hsl(0, 0, 0, 0.4))
    // TODO: code duplication with .tab._hover
    e.set("text-shadow", array.join(["1px 0px 1px " + dom.hsl(0, 0, 0, 0.4),
                                     "0px 1px 1px " + dom.hsl(0, 0, 0, 0.4)], ","))
    e.set("border-color", dom.hsl(0, 0, 0, 0.2))
    e.set("color", dom.hsl(0, 0, 99, 0.95)) // TODO minor code duplication with "common-ui" module
  })

  var tabFocusedStyle = dom.style(function (e) {
    e.set("background-color", dom.hsl(30, 100, 94))
    e.set("border-color",     dom.hsl(30, 100, 40))
  })

  var tabFocusedHoverStyle = dom.style(function (e) {
    e.set("background-color", dom.hsl(30, 85, 57))
    // TODO code duplication with "common-ui" module
    e.set("text-shadow", array.join(["1px 0px 1px " + dom.hsl(30, 61, 50),
                                     "0px 1px 1px " + dom.hsl(30, 61, 50)], ",")) // TODO why is this duplicated like this ?
  })

  var tabSelectedStyle = dom.style(function (e) {
    e.set("background-color", "red")
  })

  var iconStyle = dom.style(function (e) {
    e.set("height", "16px")
    e.set("border-radius", "4px")
    e.set("box-shadow", "0px 0px 15px " + dom.hsl(0, 0, 100, 0.9))
    e.set("background-color", dom.hsl(0, 0, 100, 0.35))
  })

  var faviconStyle = dom.style(function (e) {
    e.set("width", "16px")
  })

  var faviconInactiveStyle = dom.style(function (e) {
    e.set("filter", "grayscale(100%)")
  })

  var textStyle = dom.style(function (e) {
    e.styles(dom.stretch, dom.clip)
    e.set(["padding-left", "padding-right"], "2px")
  })

  var closeStyle = dom.style(function (e) {
    e.set("width", "18px")
    e.set("border-width", "1px")
    e.set(["padding-left", "padding-right"], "1px")
  })

  var closeHoverStyle = dom.style(function (e) {
    e.set("background-color", dom.hsl(0, 0, 100, 0.75))
    e.set("border-color", dom.hsl(0, 0, 90, 0.75))
  })

  var closeClickStyle = dom.style(function (e) {
    e.set("padding-top", "1px")
    e.set("background-color", dom.hsl(0, 0,  98, 0.75))
    e.set("border-color", array.join([dom.hsl(0, 0,  70, 0.75),
                                      dom.hsl(0, 0, 100, 0.75),
                                      dom.hsl(0, 0, 100, 0.80),
                                      dom.hsl(0, 0,  80, 0.75)], " "))
  })

  ui.tab.update = function (e, x) {
    e[info].set(x)
  }

  ui.tab.show = function (e, i) {
    ui.animate.from(e, i, hiddenTab)
  }

  ui.tab.hide = function (e, i) {
    // TODO a little hacky
    e.styleWhen(tabFocusedStyle, false)
    e.styleWhen(tabFocusedHoverStyle, false)
    ui.animate.to(e, i, hiddenTab, function () {
      e.remove()
    })
  }

  ui.tab.dragging = cell.value(false)

  ui.tab.make = function (oInfo, oGroup, fClick) {
    oInfo = cell.value(oInfo)
    return dom.box(function (e) {
      e[info] = oInfo

      e.styles(tabStyle)

      /*e.background(function (t) {
        t.color("transparent")
        t.image("none")
      })*/
      /*e.shadow(function (t) {
        t.remove()
      })
      e.border(function (t) {
        t.color("transparent")
      })*/

      var favicon = dom.image(function (e) {
        e.styles(iconStyle, faviconStyle)
      })

      var text = dom.box(function (e) {
        e.styles(textStyle)
        /*e.font(function (t) {
          t.ellipsis()
        })*/
      })

      var close = dom.image(function (e) {
        e.styles(iconStyle, closeStyle)
        e.src("data/images/button-close.png")

        e.bind([e.mouseover], function (over) {
          e.styleWhen(closeHoverStyle, over)
        })

        e.bind([e.mouseover, e.mousedown], function (over, down) {
          e.styleWhen(closeClickStyle, over && down.left)
        })

        // TODO this is behavior, so should be abstracted out into logic
        e.event([e.mouseclick], function (click) {
          if (click.left) {
            tabs.close([oInfo.get()])
          }
        })
      })

      // TODO about half of this stuff only needs to change when oInfo changes
      function mouseover(over, tab) {
        // TODO is this correct ?
        /*
        if (oGroup.previouslySelected === oTab.id) {
          oGroup.previouslySelected = tab.id
        }*/

        // TODO setTimeout is necessary to avoid a crash in Chrome
        setTimeout(function () {
          favicon.src("chrome://favicon/" + tab.url)
        }, 0)

        favicon.styleWhen(faviconInactiveStyle, tab.active == null)
        e.styleWhen(tabSelectedStyle, tab.selected)

        if (tab.active != null) {
          text.text(tab.title)
        } else {
          text.text("➔ " + tab.title)
        }
        text.title(tab.title)


        e.styleWhen(ui.common.hover, over)
        e.styleWhen(tabHoverStyle, over)

        e.styleWhen(tabInactiveHoverStyle, tab.active == null && over)
        e.styleWhen(tabInactiveStyle,      tab.active == null && !over)

        // TODO a bit hacky
        // TODO inefficient
        var isFocused = (tab.active != null &&
                         tab.active.focused &&
                         opt.get("group.sort.type").get() === "window")
        e.styleWhen(tabFocusedStyle, isFocused)
        e.styleWhen(tabFocusedHoverStyle, isFocused && over)

        if (over) {
          ui.urlBar.currentURL.set({ mouseX:   over.mouseX
                                   , mouseY:   over.mouseY
                                   , location: tab.location })
        } else {
          ui.urlBar.currentURL.set(null)
        }
      }

      e.event([dom.exclude(e.mouseclick, close)], function (click) {
               // TODO
        fClick(oInfo.get(), oGroup, click)
      })

      e.bind([opt.get("tabs.close.location")], function (location) {
        if (location === "left") {
          close.move(e)
          text.move(e)
          favicon.move(e)
        } else if (location === "right") {
          favicon.move(e)
          text.move(e)
          close.move(e)
        }
      })

      e.bind([e.mouseover, opt.get("tabs.close.display")], function (over, display) {
        close.visible.set(display === "every" ||
                          display === "hover" && over)
      })

      e.bind([e.mouseover, dom.exclude(e.mousedown, close)], function (over, down) {
        var b = (over && down.left)
        e.styleWhen(ui.common.click, b)
        e.styleWhen(tabClickStyle,   b)
      })

      // TODO slightly inefficient ...?
      e.bind([e.mouseover, oInfo, ui.tab.dragging], function (over, tab, drag) {
        if (drag) {
          // TODO ew
          if (e !== drag.tabs[0]) {
            mouseover(false, tab)
          }
          if (over) {
            var s = e.compare(drag.tabs[0])
            if (s === "before") {
              array.each(drag.tabs, function (x) {
                x.style(function (e) {
                  e.set("top", "")
                })
                x.moveBefore(e.parent(), e)
              })
              drag.info = oInfo
              drag.position = drag.tabs[0].getPosition()

            } else if (s === "after") {
              array.each(drag.tabs, function (x) {
                x.style(function (e) {
                  e.set("top", "")
                })
                x.moveAfter(e.parent(), e)
              })
              drag.info = oInfo
              drag.position = drag.tabs[0].getPosition()
            }
          }
        } else {
          mouseover(over, tab)
        }
      })

      var groupType = opt.get("group.sort.type")
        , dragging  = null

      e.drag({
        threshold: 10,
        when: function () {
          var s = groupType.get()
          return s === "window" || s === "group"
        },
        start: function () {
          dragging = {
            tabs: [e],
            info: oInfo,
            position: e.getPosition()
          }
          ui.tab.dragging.set(dragging)

          //e.styleWhen(util.dom.fixedPanel, true)
          /*e.style(function (e) {
          })*/
        },
        move: function (info) {
          e.style(function (e) {
            e.set("top", (info.mouseY - info.halfY - dragging.position.top) + "px")
          })
        },
        end: function () {
          var oInfo = dragging.info.get()
          tabs.move(array.map(dragging.tabs, function (x) {
            return x[info].get()
          }), oInfo.active.index)

          dragging = null
          ui.tab.dragging.set(false)

          //e.styleWhen(util.dom.fixedPanel, false)
          e.style(function (e) {
            //e.set("width", "")
            e.set("top", "")
          })
        }
      })
    })
  }
})
