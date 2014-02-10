goog.provide("ui.urlBar")

goog.require("util.url")
goog.require("util.cell")
goog.require("util.dom")
goog.require("util.re")
goog.require("util.array")

goog.scope(function () {
  var url   = util.url
    , cell  = util.cell
    , dom   = util.dom
    , re    = util.re
    , array = util.array

  ui.urlBar.currentURL = cell.value(null) // TODO maybe this shouldn't include duplicates ?

  function spacify(x) {
    return re.replace(x, /_|\-/g, " ")
  }

  function minify(x) {
    var y = url.simplify(x)

    var query = y.query
      , path  = y.path

    y.query = null
    y.path  = null
    y.file  = null

    if (query) {
      y.query = spacify(re.replace(re.replace(re.replace(decodeURIComponent(query), /^[\+&;]/, ""),
                                                                                    /[\+&;]/g, " "),
                                                                                    /=/g, ":"))
    } else if (path) {
      var last = array.last(path)
      if (array.len(path) && last !== "") {
        y.file = spacify(re.replace(decodeURIComponent(last), /\.(?:html?|php|asp)$/, ""))
      } else {
        y.path = spacify(decodeURIComponent(array.join(path, "/")))
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

  var parsedURL = cell.map(ui.urlBar.currentURL, function (x) {
    if (x === null) {
      return x
    } else {
      return minify(x.location)
    }
  })

  var panelStyle = dom.style(function (e) {
    e.styles(dom.fixedPanel)

    e.set("white-space", "pre")
    e.set("left", "0px")
    e.set("bottom", "0px")
    // TODO maybe remove this
    e.set("max-width", dom.calc("100%", "+", "1px"))

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

  var textStyle = dom.style(function (e) {
    e.set(["margin-left", "margin-right"], "3px")
  })

  var protocolStyle = dom.style(function (e) {
    e.styles(textStyle)
    e.set("font-weight", "bold")
    e.set("color", dom.hsl(120, 100, 25))
  })

  var domainStyle = dom.style(function (e) {
    e.styles(textStyle)
    e.set("font-weight", "bold")
  })

  var pathStyle = dom.style(function (e) {
    e.styles(textStyle, dom.clip)
  })

  var fileStyle = dom.style(function (e) {
    e.styles(textStyle, dom.clip)
    e.set("font-weight", "bold")
    e.set("color", "darkred") // TODO replace with hsl
  })

  var queryStyle = dom.style(function (e) {
    e.styles(textStyle, dom.clip)
    e.set("font-weight", "bold")
    e.set("color", "darkred") // TODO replace with hsl
  })

  var hashStyle = dom.style(function (e) {
    e.styles(textStyle, dom.clip)
    e.set("color", "darkblue") // TODO replace with hsl
  })

  ui.urlBar.initialize = function (e) {
    dom.box(function (e) {
      e.styles(panelStyle)

      dom.box(function (e) {
        e.styles(dom.horiz)

        /**
         * TODO more specific type for first argument
         * @param {!Object} e
         * @param {...!Array} var_args
         */
        function boxes(e, var_args) {
          var a = array.map(array.slice(arguments, 1), function (a) {
            return {
              name: a[0],
              box: dom.box(function (e) {
                e.styles(a[1])
              }).move(e)
            }
          })
          e.event([parsedURL], function (o) {
            if (o !== null) {
              // TODO util.array.eachReverse
              var i = array.len(a)
              while (i--) {
                var x = a[i]
                  , s = x.name
                if (o[s]) {
                  x.box.text(o[s])
                  x.box.visible.set(true)
                } else {
                  x.box.visible.set(false)
                }
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

      e.bind([ui.urlBar.currentURL], function (current) {
        if (current === null) {
          e.visible.set(false)
        } else {
          e.visible.set(true)
          var o = e.getPosition()
          if (current.mouseX <= o.right && current.mouseY >= o.top) {
            e.visible.set(false)
          }
        }
      })
    }).move(e)
  }
})
