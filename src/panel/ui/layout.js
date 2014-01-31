// TODO grid mode is incorrect, should calculate everything in JS
goog.provide("ui.layout")

goog.require("util.dom")

goog.scope(function () {
  var dom = util.dom

  ui.layout.group = {
    "vertical": dom.style(function (e) {
      e.set("top", "-1px")
      e.set("border-top-width", "1px")
    }),
    "horizontal": dom.style(function (e) {
      e.styles(dom.stretch)

      e.set("background-color", "white") // TODO
      e.set("border-color", "dodgerblue")

      //e.set("box-shadow", "0px 0px 10px black")
      /*e.set("border-left-image", ui.gradient("to left", ["0%",   "black"],
                                                        ["100%", "transparent"]))*/

      //e.set("overflow", "hidden")

      //e.set("overflow", "hidden")
      //e.stretch(true)
      //e.set("left", "-2px")
      //e.set(["border-left-width", "border-right-width"], "2px")
      //e.set(["border-left-style", "border-right-style"], "groove")

      //e.set("max-width", "400px")
      e.set("padding-right", "10px")
      e.set("min-width", "120px")
      e.set("height", "100%")
      //e.set("padding-right", "20px")

      /*e.set("border-top-color", "dodgerblue")
      e.set("border-top-width", "2px")
      e.set("border-top-style", "groove")
      e.set("margin-top", "-15px")
      e.set("padding-top", "15px")*/
      //e.set("background-color", "inherit")

    }),
    "grid": dom.style(function (e) {
      e.set("overflow", "hidden")
      //e.stretch(true)
      e.set("margin-top", "-1px")
      e.set("margin-left", "-1px")
      e.set("border-top-width", "1px")
      e.set("border-left-width", "1px")
      //e.set("border-width", "1px")

      //e.set("flex-grow", "1")
      e.set("width",  dom.calc((1 / 3) * 100 + "%", "+", "1px"))
      e.set("height", dom.calc((1 / 2) * 100 + "%", "+", "1px"))
    })
  }

  ui.layout.groupFocused = {
    "horizontal": dom.style(function (e) {
      e.set("z-index", "2")
      //e.set("background-color", "green")
    })
  }

  ui.layout.groupLast = {
    "horizontal": dom.style(function (e) {
      //e.set("min-width", "400px")
    })
  }

  ui.layout.groupTop = {
    "horizontal": dom.style(function (e) {
      e.set("z-index", "1")

      e.set("background-color", "inherit")
      e.set("border-color", "inherit")

      e.set(["border-top-left-radius", "border-top-right-radius"], "5px")

      //e.set("left", "-2px")
      e.set(["border-left-width", "border-top-width", "border-right-width"], "5px")
      e.set(["border-left-style", "border-top-style"], "groove")
      e.set("border-right-style", "ridge")
      e.set("width", "100px")
    })
  }

  ui.layout.groupTopInner = {
    "horizontal": dom.style(function (e) {
      e.set("background-color", "inherit")
      e.set("border-radius", "inherit")
      e.set("padding-bottom", "1px")
    })
  }

  ui.layout.groupTabs = {
    "horizontal": dom.style(function (e) {
      e.set("background-color", "inherit")
      e.set("border-color", "inherit")

      e.set("border-width", "5px")
      e.set(["border-top-style",   "border-left-style"], "groove")
      e.set(["border-right-style", "border-bottom-style"], "ridge")

      e.set(["border-top-right-radius", "border-bottom-left-radius", "border-bottom-right-radius"], "5px")

      e.set("top", "-1px")

      e.set("overflow", "auto")
      e.set("width", "400px")
      e.set("height", dom.calc("100%", "-", "18px", "+", "1px"))
    }),
    "grid": dom.style(function (e) {
      e.set("overflow", "auto")
      e.set("width", "100%")
      e.set("height", dom.calc("100%", "-", "18px"))
      //e.set("height", "100%")
    })
  }

  ui.layout.groupList = {
    "vertical": dom.style(function (e) {
    }),
    "horizontal": dom.style(function (e) {
      e.styles(dom.horiz)
      e.set("padding", "20px")
    }),
    "grid": dom.style(function (e) {
      e.styles(dom.horiz)
      e.set("align-content", "stretch")
      e.set("flex-wrap", "wrap")
      e.set("width", dom.calc("100%", "-", "5px"))
    })
  }
})
