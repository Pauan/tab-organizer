goog.provide("ui.tab")

goog.require("util.Symbol")
goog.require("util.dom")
goog.require("util.array")
goog.require("ui.urlBar")
goog.require("ui.common")
goog.require("ui.animate")
goog.require("tabs")
goog.require("opt")

goog.scope(function () {
  var Symbol = util.Symbol
    , dom    = util.dom
    , array  = util.array

  var fn = Symbol("fn")

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

  ui.tab.update = function (e, oTab) {
    e[fn](oTab)
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

  ui.tab.make = function (oTab, oGroup, fClick) {
    return dom.box(function (e) {
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
            tabs.close([oTab])
          }
        })
      })

      function mouseover(over) {
        e.styleWhen(ui.common.hover, over)
        e.styleWhen(tabHoverStyle, over)

        e.styleWhen(tabInactiveHoverStyle, oTab.active == null && over)
        e.styleWhen(tabInactiveStyle,      oTab.active == null && !over)

        // TODO a bit hacky
        // TODO inefficient
        var isFocused = (oTab.active != null &&
                         oTab.active.focused &&
                         opt.get("group.sort.type").get() === "window")
        e.styleWhen(tabFocusedStyle, isFocused)
        e.styleWhen(tabFocusedHoverStyle, isFocused && over)

        if (over) {
          ui.urlBar.currentURL.set({ mouseX:   over.mouseX
                                   , mouseY:   over.mouseY
                                   , location: oTab.location })
        } else {
          ui.urlBar.currentURL.set(null)
        }
      }

      e[fn] = function (tab) {
        // TODO is this correct ?
        if (oGroup.previouslySelected === oTab.id) {
          oGroup.previouslySelected = tab.id
        }
        oTab = tab

        // TODO setTimeout is necessary to avoid a crash in Chrome
        setTimeout(function () {
          favicon.src("chrome://favicon/" + tab.url)
        }, 0)

        favicon.styleWhen(faviconInactiveStyle, oTab.active == null)
        e.styleWhen(tabSelectedStyle, oTab.selected)

        if (oTab.active != null) {
          text.text(oTab.title)
        } else {
          text.text("➔ " + oTab.title)
        }
        text.title(oTab.title)

        mouseover(e.mouseover.get())
      }
      e[fn](oTab)

      e.event([dom.exclude(e.mouseclick, close)], function (click) {
        fClick(oTab, oGroup, click)
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

      e.event([e.mouseover], mouseover)

      e.bind([e.mouseover, opt.get("tabs.close.display")], function (over, display) {
        if (display === "every") {
          close.show()
        } else if (display === "hover" && over) {
          close.show()
        } else {
          close.hide()
        }
      })

      e.bind([e.mouseover, dom.exclude(e.mousedown, close)], function (over, down) {
        e.styleWhen(ui.common.click, over && down.left)
        e.styleWhen(tabClickStyle,   over && down.left)
      })
    })
  }
})
