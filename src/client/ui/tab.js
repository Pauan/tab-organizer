goog.provide("ui.tab")

goog.require("util.Symbol")
goog.require("util.dom")
goog.require("util.array")
goog.require("util.log")
goog.require("util.cell")
goog.require("util.math")
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
    , assert = util.log.assert
    , cell   = util.cell
    , math   = util.math

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

  ui.tab.make = function (oInfo, oCall) {
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

      var isFocused = cell.bind([oInfo, opt.get("group.sort.type")], function (tab, sort) {
        return (tab.active != null &&
                tab.active.focused &&
                sort === "window")
      })

      var isDragging = cell.bind([ui.tab.dragging], function (drag) {
        if (drag) {
          return array.some(drag.tabs, function (x) {
            return x === e
          })
        } else {
          return null
        }
      })

      var mouseover = cell.bind([e.mouseover, isDragging], function (over, dragging) {
        if (dragging === true) {
          return true
        } else if (dragging === false) {
          return false
        } else if (dragging === null) {
          return over
        }
      })

      e.bind([isFocused], function (b) {
        e.styleWhen(tabFocusedStyle, b)
      })

      e.bind([isFocused, mouseover], function (b, over) {
        e.styleWhen(tabFocusedHoverStyle, b && over)
      })

      e.bind([oInfo], function (tab) {
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
      })

      e.bind([oInfo, mouseover], function (tab, over) {
        e.styleWhen(tabInactiveHoverStyle, tab.active == null && over)
        e.styleWhen(tabInactiveStyle,      tab.active == null && !over)

        if (over) {
          ui.urlBar.currentURL.set({ mouseX:   over.mouseX
                                   , mouseY:   over.mouseY
                                   , location: tab.location })
        } else {
          ui.urlBar.currentURL.set(null)
        }
      })

      e.bind([mouseover], function (over) {
        e.styleWhen(ui.common.hover, over)
        e.styleWhen(tabHoverStyle, over)
      })

      e.event([dom.exclude(e.mouseclick, close)], function (click) {
        oCall.click(e, click)
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

      e.bind([mouseover, opt.get("tabs.close.display")], function (over, display) {
        close.visible.set(display === "every" ||
                          display === "hover" && over)
      })

      e.bind([mouseover, dom.exclude(e.mousedown, close), isDragging], function (over, down, dragging) {
        var b = (dragging === null && over && down.left)
        e.styleWhen(ui.common.click, b)
        e.styleWhen(tabClickStyle,   b)
      })

      // TODO slightly inefficient ...?
      e.bind([e.mouseover, ui.tab.dragging], function (over, drag) {
        if (drag && over) {
          var s = e.compare(drag.placeholder)
          if (s === "before") {
            /*array.each(drag.tabs, function (x) {
              x.style(function (e) {
                e.set("top", "")
              })
              x.moveBefore(e.parent(), e)
            })*/
            drag.placeholder.moveBefore(e)
            drag.type = "before"
            drag.to = e
            //drag.position = drag.tabs[0].getPosition()

          } else if (s === "after") {
            /*array.each(drag.tabs, function (x) {
              x.style(function (e) {
                e.set("top", "")
              })
              x.moveAfter(e.parent(), e)
            })*/
            drag.placeholder.moveAfter(e)
            drag.type = "after"
            drag.to = e
            //drag.position = drag.tabs[0].getPosition()
          }
        }
      })

      var groupType = opt.get("group.sort.type")
        , dragging  = null

      // TODO make the tab dom.fixedPanel and insert a placeholder element
      e.drag({
        threshold: 5,
        when: function () {
          var s = groupType.get()
          // TODO
          return s === "window"// || s === "group"
        },
        start: function () {
          dragging = {
            type: "before",
            tabs: oCall.getTabs(e),
            to: e
            //position: e.getPosition(),
          }

          var top    = null
            , width  = 0
            , height = 0

          dragging.container = dom.box(function (e) {
            e.styles(dom.fixedPanel, dom.noMouse)
            // TODO use dom.style
            e.style(function (e) {
              e.set("opacity", "0.75")
            })
          }).moveBefore(e)

          dragging.placeholder = dom.box().moveBefore(e)

          ui.tab.dragging.set(dragging)

          array.each(dragging.tabs, function (e) {
            var pos = e.getPosition()
            if (top === null) {
              top = pos.top
            } else {
              top = math.min(top, pos.top)
            }
            width   = math.max(width, pos.width)
            height += pos.height
            e.move(dragging.container)
          })

          dragging.top    = top // TODO this isn't the same as dragging.container.getPosition().top
          dragging.height = height

          dragging.container.style(function (e) {
            e.set("width", width + "px")
          })
          dragging.placeholder.style(function (e) {
            e.set("height", height + "px")
          })
        },
        move: function (info) {
          dragging.container.style(function (e) {
            var minY = dragging.top + info.halfY
              , maxY = dragging.top + dragging.height - info.halfY
            if (info.mouseY < minY) {
              dragging.top = (info.mouseY - info.halfY)
            } else if (info.mouseY > maxY) {
              dragging.top = (info.mouseY + info.halfY - dragging.height)
            }
            e.set("top", dragging.top + "px")
          })
        },
        end: function () {
          var oInfo = dragging.to[info].get()

          var index = (dragging.type === "after"
                        ? oInfo.active.index + 1
                        : oInfo.active.index)
/*
          // TODO hacky, should be handled by server/platform/tabs
          if (index > curr && oInfo.active.window === oOld.active.window) {
            --index
          }*/

          /*var a = array.map(dragging.tabs, function (x) {
            return x[info].get()
          })*/

          oCall.move(dragging.tabs, index, dragging.to)

          array.each(dragging.tabs, function (e) {
            e.moveBefore(dragging.placeholder)
          })

          dragging.container.remove()
          dragging.placeholder.remove()

          dragging = null
          ui.tab.dragging.set(false)
        }
      })
    })
  }
})
