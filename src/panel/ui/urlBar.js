define("url-bar", function (require, exports) {
  "use strict";

  var url   = require("lib/util/url")
    , ui    = require("lib/util/ui")
    , cell  = require("lib/util/cell")

  exports.currentURL = cell.value(null) // TODO maybe this shouldn't include duplicates ?

  function spacify(x) {
    return x.replace(/_|\-/g, " ")
  }

  function minify(x) {
    var y = url.simplify(x)

    var query = y.query
      , path  = y.path

    y.query = null
    y.path  = null
    y.file  = null

    if (query) {
      y.query = spacify(decodeURIComponent(query).replace(/^[\+&;]/, "")
                                                 .replace(/[\+&;]/g, " ")
                                                 .replace(/=/g, ":"))
    } else if (path) {
      var last = path[path.length - 1]
      if (path.length && last !== "") {
        y.file = spacify(decodeURIComponent(last).replace(/\.(?:html?|php|asp)$/, ""))
      } else {
        y.path = spacify(decodeURIComponent(path.join("/")))
        // TODO a bit hacky
        if (y.path === "/") {
          y.path = null
        }
      }
    }

    if (y.fragment) {
      y.fragment = spacify(decodeURIComponent(y.fragment))
    }

    return y
  }

  // TODO replace with a normal map, probably
  var parsedURL = cell.mapfilter({}, exports.currentURL, function (x) {
    return x !== null
  }, function (x) {
    return minify(x.location)
  })

  var panelStyle = ui.style(function (e) {
    e.styles(ui.fixedPanel)

    e.set("white-space", "pre")
    e.set("left", "0px")
    e.set("bottom", "0px")
    // TODO maybe remove this
    e.set("max-width", ui.calc("100%", "+", "1px"))

    e.set(["border-top-width", "border-right-width"], "1px")
    e.set(["border-top-color", "border-right-color"], "black")
    e.set("border-top-right-radius", "5px")

    //e.set("paddingTop", "0px")
    e.set("padding-right", "2px") // 2px + 3px = 5px
    e.set("padding-bottom", "1px")
    //e.set("padding-left", "2px")

      //t.ellipsis()
    e.set("color", "black")

    e.set("background-color", "white")

    e.set("box-shadow", "0px 0px 3px dimgray")
  })

  var textStyle = ui.style(function (e) {
    e.set(["margin-left", "margin-right"], "3px")
  })

  var protocolStyle = ui.style(function (e) {
    e.styles(textStyle)
    e.set("font-weight", "bold")
    e.set("color", ui.hsl(120, 100, 25))
  })

  var domainStyle = ui.style(function (e) {
    e.styles(textStyle)
    e.set("font-weight", "bold")
  })

  var pathStyle = ui.style(function (e) {
    e.styles(textStyle, ui.clip)
  })

  var fileStyle = ui.style(function (e) {
    e.styles(textStyle, ui.clip)
    e.set("font-weight", "bold")
    e.set("color", "darkred") // TODO replace with hsl
  })

  var queryStyle = ui.style(function (e) {
    e.styles(textStyle, ui.clip)
    e.set("font-weight", "bold")
    e.set("color", "darkred") // TODO replace with hsl
  })

  var hashStyle = ui.style(function (e) {
    e.styles(textStyle, ui.clip)
    e.set("color", "darkblue") // TODO replace with hsl
  })

  exports.initialize = function (e) {
    ui.box(function (e) {
      e.styles(panelStyle)

      ui.box(function (e) {
        e.styles(ui.horiz)

        function boxes(e) {
          var a = [].slice.call(arguments, 1).map(function (a) {
            return {
              name: a[0],
              box: ui.box(function (e) {
                e.styles(a[1])
              }).move(e)
            }
          })
          e.event([parsedURL], function (o) {
            var i = a.length
            while (i--) {
              var x = a[i]
                , s = x.name
              if (o[s]) {
                x.box.text(o[s])
                x.box.show()
              } else {
                x.box.hide()
              }
            }
          })
        }

        boxes(e, ["scheme",   protocolStyle],
                 ["hostname", domainStyle],
                 ["path",     pathStyle],
                 ["file",     fileStyle],
                 ["query",    queryStyle],
                 ["fragment", hashStyle])
      }).move(e)

      e.bind([exports.currentURL], function (current) {
        if (current === null) {
          e.hide()
        } else {
          e.show()
          var o = e.getPosition()
          if (current.mouseX <= o.right && current.mouseY >= o.top) {
            e.hide()
          }
        }
      })
    }).move(e)
  }
})
