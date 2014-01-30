define("tab-ui", function (require, exports) {
  "use strict";

  var name      = require("lib/util/name")
    , ui        = require("lib/util/ui")
    , tab       = require("tab")
    , opt       = require("opt")
    , urlBar    = require("url-bar")
    , common_ui = require("common-ui")
    , animate   = require("animate")

  var fn = new name.Name()

  var hiddenTab = animate.object({
    //transform: "scale(0)",
    //scaleY: "0",

    borderTopWidth: "0px",
    borderBottomWidth: "0px",
    paddingTop: "0px",
    paddingBottom: "0px",

    //marginLeft: "15px",
    height: "0px",
    opacity: "0"
  })

  var tabStyle = ui.style(function (e) {
    e.styles(ui.horiz, ui.clip, common_ui.normal)
    e.set("border-width", "1px")
    e.set("padding", "1px")
    e.set("height", "20px")
    e.set("border-radius", "5px")
  })

  var tabHoverStyle = ui.style(function (e) {
    e.set("font-weight", "bold")
  })

  var tabClickStyle = ui.style(function (e) {
    e.set("padding-top", "2px")
    e.set("padding-bottom", "0px")
  })

  var tabInactiveStyle = ui.style(function (e) {
    e.set("color", ui.hsl(0, 0, 30))
    e.set("opacity", "0.75")
  })

  var tabInactiveHoverStyle = ui.style(function (e) {
    e.set("background-color", ui.hsl(0, 0, 0, 0.4))
    // TODO: code duplication with .tab._hover
    e.set("text-shadow", ["1px 0px 1px " + ui.hsl(0, 0, 0, 0.4),
                          "0px 1px 1px " + ui.hsl(0, 0, 0, 0.4)].join(","))
    e.set("border-color", ui.hsl(0, 0, 0, 0.2))
    e.set("color", ui.hsl(0, 0, 99, 0.95)) // TODO minor code duplication with "common-ui" module
  })

  var tabFocusedStyle = ui.style(function (e) {
    e.set("background-color", ui.hsl(30, 100, 94))
    e.set("border-color",     ui.hsl(30, 100, 40))
  })

  var tabFocusedHoverStyle = ui.style(function (e) {
    e.set("background-color", ui.hsl(30, 85, 57))
    // TODO code duplication with "common-ui" module
    e.set("text-shadow", ["1px 0px 1px " + ui.hsl(30, 61, 50),
                          "0px 1px 1px " + ui.hsl(30, 61, 50)].join(",")) // TODO why is this duplicated like this ?
  })

  var tabSelectedStyle = ui.style(function (e) {
    e.set("background-color", "red")
  })

  var iconStyle = ui.style(function (e) {
    e.set("height", "16px")
    e.set("border-radius", "4px")
    e.set("box-shadow", "0px 0px 15px " + ui.hsl(0, 0, 100, 0.9))
    e.set("background-color", ui.hsl(0, 0, 100, 0.35))
  })

  var faviconStyle = ui.style(function (e) {
    e.set("width", "16px")
  })

  var faviconInactiveStyle = ui.style(function (e) {
    e.set("filter", "grayscale(100%)")
  })

  var textStyle = ui.style(function (e) {
    e.styles(ui.stretch, ui.clip)
    e.set(["padding-left", "padding-right"], "2px")
  })

  var closeStyle = ui.style(function (e) {
    e.set("width", "18px")
    e.set("border-width", "1px")
    e.set(["padding-left", "padding-right"], "1px")
  })

  var closeHoverStyle = ui.style(function (e) {
    e.set("background-color", ui.hsl(0, 0, 100, 0.75))
    e.set("border-color", ui.hsl(0, 0, 90, 0.75))
  })

  var closeClickStyle = ui.style(function (e) {
    e.set("padding-top", "1px")
    e.set("background-color", ui.hsl(0, 0,  98, 0.75))
    e.set("border-color", [ui.hsl(0, 0,  70, 0.75),
                           ui.hsl(0, 0, 100, 0.75),
                           ui.hsl(0, 0, 100, 0.80),
                           ui.hsl(0, 0,  80, 0.75)].join(" "))
  })

  exports.update = function (e, oTab) {
    e[fn](oTab)
  }

  exports.show = function (e, i) {
    animate.from(e, i, hiddenTab)
  }

  exports.hide = function (e, i) {
    // TODO a little hacky
    e.styleWhen(tabFocusedStyle, false)
    e.styleWhen(tabFocusedHoverStyle, false)
    animate.to(e, i, hiddenTab, function () {
      e.remove()
    })
  }

  exports.make = function (oTab, oGroup, fClick) {
    return ui.box(function (e) {
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

      var favicon = ui.image(function (e) {
        e.styles(iconStyle, faviconStyle)
      })

      var text = ui.box(function (e) {
        e.styles(textStyle)
        /*e.font(function (t) {
          t.ellipsis()
        })*/
      })

      var close = ui.image(function (e) {
        e.styles(iconStyle, closeStyle)
        e.src("images/button-close.png")

        e.bind([e.mouseover], function (over) {
          e.styleWhen(closeHoverStyle, over)
        })

        e.bind([e.mouseover, e.mousedown], function (over, down) {
          e.styleWhen(closeClickStyle, over && down.left)
        })

        e.event([e.mouseclick], function (click) {
          if (click.left) {
            tab.close([oTab.id])
          }
        })
      })

      function mouseover(over) {
        e.styleWhen(common_ui.hover, over)
        e.styleWhen(tabHoverStyle, over)

        e.styleWhen(tabInactiveHoverStyle, !oTab.active && over)
        e.styleWhen(tabInactiveStyle,      !oTab.active && !over)

        // TODO a bit hacky
        // TODO inefficient
        var isFocused = (oTab.active && oTab.active.focused && opt.get("group.sort.type").get() === "window")
        e.styleWhen(tabFocusedStyle, isFocused)
        e.styleWhen(tabFocusedHoverStyle, isFocused && over)

        if (over) {
          urlBar.currentURL.set({ mouseX:   over.mouseX
                                , mouseY:   over.mouseY
                                , location: oTab.location })
        } else {
          urlBar.currentURL.set(null)
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

        favicon.styleWhen(faviconInactiveStyle, !oTab.active)
        e.styleWhen(tabSelectedStyle, oTab.selected)

        if (oTab.active) {
          text.text(oTab.title)
        } else {
          text.text("➔ " + oTab.title)
        }
        text.title(oTab.title)

        mouseover(e.mouseover.get())
      }
      e[fn](oTab)

      e.event([ui.exclude(e.mouseclick, close)], function (click) {
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

      e.bind([e.mouseover, ui.exclude(e.mousedown, close)], function (over, down) {
        e.styleWhen(common_ui.click, over && down.left)
        e.styleWhen(tabClickStyle,   over && down.left)
      })
    })
  }
})
