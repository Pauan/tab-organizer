goog.provide("ui.common")

goog.require("util.cell")
goog.require("util.dom")
goog.require("util.array")
goog.require("opt")

goog.scope(function () {
  var dom   = util.dom
    , cell  = util.cell
    , array = util.array

  var hues = {
    "pink": 0,
    "red": 0,
    "orange": 30,
    "yellow": 60,
    "green": 110,
    "blue": 211,
    "purple": 280,

    "black": 0,
    "grey": 0,
    "white": 0,
  }

  var lightness = {
    "pink": 95,
    "red": 50,
    "orange": 50,
    "yellow": 65,
    "green": 38,
    "blue": 65,
    "purple": 80,

    "black": 10,
    "grey": 60,
    "white": 95
  }

  function skewHue(hue, sat, light, alpha) {
    if (hue === "black" || hue === "grey" || hue === "white") {
      sat = 0
    }
                               // Base of 65
    return dom.hsl(hues[hue], sat, light, alpha)
  }

  function skew(hue, sat, light, alpha) {
                               // Base of 65
    return skewHue(hue, sat, (lightness[hue] - 65) + light, alpha)
    // 60
    //var i = (Math.abs(60 - (hue % 120)) * 0.7) + 58
    //return hsl(hue, sat, (i / 100) * light, alpha)
  }

  /*function noskew(hue, sat, light, alpha) {
    return hsl(hues[hue], sat, light, alpha)
  }*/

  function text(hue, sat, light, alpha) {
    if (hue === "yellow" || hue === "pink" || hue === "white") {
      light = 100 - light
    }
    return dom.hsl(hues[hue], sat, light, alpha)
  }

  function shadow(hue, sat, light, alpha) {
    if (hue === "yellow" || hue === "pink" || hue === "white") {
      return dom.hsl(hues[hue], 0, 100, alpha)
    } else {
      if (hue === "black" || hue === "grey" || hue === "white") {
        sat = 0
      }
      return dom.hsl(hues[hue], sat, light, alpha)
    }
  }

  var repeating = dom.repeatingGradient("-45deg",
                                        ["0px",  "transparent"],
                                        ["4px",  "transparent"],
                                        ["6px",  dom.hsl(0, 0, 100, 0.05)],
                                        ["10px", dom.hsl(0, 0, 100, 0.05)])

  ui.common.background = dom.style(function (e) {
    e.set("background-color", "white")
    e.set("background-image", dom.repeatingGradient("0deg", ["0px", "transparent"],
                                                            ["2px", dom.hsl(200, 30, 30, 0.022)],
                                                            ["3px", dom.hsl(200, 30, 30, 0.022)]))
  })

  ui.common.topBar = dom.style(function (e) {
    // TODO a bit hacky
    cell.when(opt.loaded, function () {
      cell.bind([opt.get("theme.color")], function (hue) {
        var color = skew(hue, 100, 45, 0.75) // 100, 45, 0.75
        e.set("border-color", color)
        e.set("box-shadow", array.join([      "0px 0px 8px 1px " + color,
                                        "inset 0px 0px 3px 0px " + color], ","))
      })
    })
  })

  ui.common.topSeparator = dom.style(function (e) {
    // TODO a bit hacky
    cell.when(opt.loaded, function () {
      cell.bind([opt.get("theme.color")], function (hue) {
        e.set("border-left-color", skew(hue, 100, 50)) // "dodgerblue"
      })
    })
  })

  ui.common.normal = dom.style(function (e) {
    e.set("cursor", "pointer")
    e.set("border-width", "1px")
    e.set("transition-property", "background-color")
    e.set("transition-timing-function", "ease-in-out")

    // TODO a bit hacky
    cell.when(opt.loaded, function () {
      cell.bind([opt.get("theme.color")], function (hue) {
        e.set("text-shadow", "0px 1px 1px " + skew(hue, 61, 50, 0.1))
      })

      // TODO a bit of code duplication with ui.common.hover
      cell.bind([opt.get("theme.animation")], function (anim) {
        if (anim) {
          e.set("transition-duration", "100ms")
        } else {
          e.set("transition-duration", "0ms")
        }
      })
    })
  })

  ui.common.hover = dom.style(function (e) {
    e.set("transition-duration", "0ms")

    e.set("background-image", array.join([dom.gradient("to bottom", ["0%",   dom.hsl(0, 0, 100, 0.2)],
                                                                    ["49%",  "transparent"         ],
                                                                    ["50%",  dom.hsl(0, 0,   0, 0.1)],
                                                                    ["80%",  dom.hsl(0, 0, 100, 0.1)],
                                                                    ["100%", dom.hsl(0, 0, 100, 0.2)]),
                                          repeating], ","))
    e.set("box-shadow", array.join([      "1px 1px  1px " + dom.hsl(0, 0,   0, 0.25),
                                    "inset 0px 0px  3px " + dom.hsl(0, 0, 100, 1   ),
                                    "inset 0px 0px 10px " + dom.hsl(0, 0, 100, 0.25)], ","))

    // TODO a bit hacky
    cell.when(opt.loaded, function () {
      cell.bind([opt.get("theme.color")], function (hue) {
        e.set("color",            text(hue, 100, 99, 0.95))
        e.set("background-color", skew(hue, 100, 65))
        e.set("border-color",     skew(hue, 38, 57))
        e.set("text-shadow",      array.join(["1px 0px 1px " + shadow(hue, 61, 50),
                                              "0px 1px 1px " + shadow(hue, 61, 50)], ",")) // TODO why is this duplicated like this ?
      })
    })
  })

  ui.common.click = dom.style(function (e) {
    e.set("background-position", "0px 1px")

    e.set("background-image", array.join([dom.gradient("to bottom", ["0%",   dom.hsl(0, 0, 100, 0.2)  ],
                                                                    ["49%",  "transparent"           ],
                                                                    ["50%",  dom.hsl(0, 0,   0, 0.075)],
                                                                    ["80%",  dom.hsl(0, 0, 100, 0.1)  ],
                                                                    ["100%", dom.hsl(0, 0, 100, 0.2)  ]),
                                          repeating], ","))
    e.set("box-shadow", array.join([      "1px 1px 1px "  + dom.hsl(0, 0,   0, 0.1),
                                    "inset 0px 0px 3px "  + dom.hsl(0, 0, 100, 0.9),
                                    "inset 0px 0px 10px " + dom.hsl(0, 0, 100, 0.225)], ","))
  })

  ui.common.group = dom.style(function (e) {
    // TODO a bit hacky
    cell.when(opt.loaded, function () {
      cell.bind([opt.get("theme.color")], function (hue) {
        e.set("border-color", skewHue(hue, 50, 75))
      })
    })
  })
})
