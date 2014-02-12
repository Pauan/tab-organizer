goog.provide("options")
goog.provide("space")

goog.require("util.dom")
goog.require("util.cell")
goog.require("util.array")
goog.require("util.math")
goog.require("util.string")
goog.require("opt")
goog.require("cache")
goog.require("lib.options")

goog.scope(function () {
  var dom  = util.dom
    , math = util.math

  space.horiz = function (s) {
    return dom.box(function (e) {
      e.style(function (e) {
        e.set("width", s)
      })
    })
  }

  space.vert = function (s) {
    return dom.box(function (e) {
      e.style(function (e) {
        e.set("height", s)
      })
    })
  }
})

goog.scope(function () {
  var cell  = util.cell
    , dom   = util.dom
    , array = util.array
    , math  = util.math

  var changes = {
    screenBackground: dom.hsl(211, 13, 55),
    popupBorder:      dom.hsl(211, 100, 10),
    popupBackground:  dom.hsl(211, 100, 96)
  }

  var containerWidth = 512 // 1024 / 2

  var preview = dom.style(function (e) {
    e.set("border-width", "1px")
    e.set("border-radius", "5px")
    e.set("border-color", "black")
    e.set("margin-top", "0.4em")
    e.set("margin-bottom", "7px")
    e.set("width", "100%")
    e.set("height", "200px")
  })

  var closeButton = dom.style(function (e) {
    e.set("width", "14px")
    e.set("height", "14px")
  })

  var popupContainer = dom.style(function (e) {
    e.set("width", containerWidth + "px")
  })

  var popupInnerContainer = dom.style(function (e) {
    e.set("width", "100%")
    e.set("height", ((dom.screen.height / dom.screen.width) * containerWidth) + "px")
    e.set("border-width", "1px")
    e.set("border-color", "black")
    e.set("background-color", "black")
    e.set("margin-top", "5px")
    e.set("margin-bottom", "7px")
  })

  var popupVerticalLine = dom.style(function (e) {
    e.styles(dom.panel)
    e.set("left", "50%")
    e.set("top", "0px")
    e.set("width", "1px")
    e.set("height", "100%")
    e.set("background-color", "red")
  })

  var popupHorizontalLine = dom.style(function (e) {
    e.styles(dom.panel)
    e.set("left", "0px")
    e.set("top", "50%")
    e.set("width", "100%")
    e.set("height", "1px")
    e.set("background-color", "red")
  })

  var popupPopupTable = dom.style(function (e) {
    e.set("width", "100%")
    e.set("height", "100%")
  })

  var popupPopupText = dom.style(function (e) {
    e.set("text-align", "center")
    e.set("vertical-align", "middle")
  })

  var popupWidthContainer = dom.style(function (e) {
    e.styles(dom.panel)
    e.set("left", "50%")
    e.set("bottom", "2px")
  })

  var popupWidthText = dom.style(function (e) {
    e.set("font-weight", "bold")
    e.set("font-size", "12px")
    e.set("text-shadow", dom.textStroke("white", "1px"))
    e.set("left", "-50%")
  })

  var popupHeightContainer = dom.style(function (e) {
    e.styles(dom.panel)
    e.set("top", "50%")
    e.set("right", "3px")
  })

  var popupHeightText = dom.style(function (e) {
    e.set("font-weight", "bold")
    e.set("font-size", "12px")
    e.set("text-shadow", dom.textStroke("white", "1px"))
    e.set("top", dom.calc("-0.5em", "-", "1px"))
  })

  var popupControlTable = dom.style(function (e) {
    e.set(["margin-left", "margin-right"], "auto")
  })

  var popupControlText = dom.style(function (e) {
    e.styles(dom.stretch)
    e.set("white-space", "pre") // TODO hacky
    e.set("margin-right", "2px")
  })

  var popupControlCell = dom.style(function (e) {
    e.set("text-align", "right")
  })

  var controls = []

  cell.when(cell.and(opt.loaded, cache.loaded), function () {
    lib.options.initialize({
      get: function (s) {
        return opt.get(s)
      },
      getDefault: function (s) {
        return opt.getDefault(s)
      }
    }, function (e) {
      var popupScreen = dom.style(function (e) {
        e.set("background-color", changes.screenBackground)

        cell.bind([cache.get("screen.available.left"),
                   cache.get("screen.available.top"),
                   cache.get("screen.available.width"),
                   cache.get("screen.available.height")], function (left, top, width, height) {
          e.set("left",   (left   / dom.screen.width)  * 100 + "%")
          e.set("top",    (top    / dom.screen.height) * 100 + "%")
          e.set("width",  (width  / dom.screen.width)  * 100 + "%")
          e.set("height", (height / dom.screen.height) * 100 + "%")
        })
      })

      var popupPopup = dom.style(function (e) {
        e.styles(dom.panel, dom.clip)
        e.set("border-width", "1px")
        e.set("border-color", changes.popupBorder)
          // t.color("rgb(0, 100, 0)")
        e.set("background-color", changes.popupBackground)
          //t.color("rgb(240, 255, 240)")

        function convert(x, y) {
          return (x / y) * 100
        }

        // -100 = (screen * 0)   - (width * 0)
        // 0    = (screen * 0.5) - (width * 0.5)
        // 100  = (screen * 1)   - (width * 1)
        function bindPos(sMethod, c, a, bubble, dir) {
          a = array.concat([opt.get("popup.type"),
                            opt.get("size.sidebar.position"),
                            cache.get(c)], array.map(a, function (s) {
            return opt.get(s)
          }))
          cell.bind(a, function (type, position, avail, popup, size) {
            if (type === "popup") {
              e.set(sMethod, (popup * 100) - (convert(size, avail) * popup) + "%")
            } else if (type === "bubble") {
              if (bubble) {
                e.set(sMethod, convert(64, avail) + "%")
              } else {
                e.set(sMethod, "")
              }
            } else if (type === "tab") {
              if (bubble) {
                e.set(sMethod, convert(62, avail) + "%")
              } else {
                e.set(sMethod, "0px")
              }
            } else if (type === "sidebar") {
              if (position === dir) {
                e.set(sMethod, "")
              } else {
                e.set(sMethod, "0px")
              }
            }
          })
        }

        function bindSize(sMethod, c, a, s1, s2, s3, s4) {
          a = array.concat([opt.get("popup.type"),
                            opt.get("size.sidebar"),
                            opt.get("size.sidebar.position"),
                            cache.get(c)], array.map(a, function (s) {
            return opt.get(s)
          }))
          cell.bind(a, function (type, size, position, avail, popup, bubble) {
            if (type === "popup") {
              e.set(sMethod, convert(popup, avail) + "%")
            } else if (type === "bubble") {
              e.set(sMethod, convert(bubble, avail) + "%")
            } else if (type === "tab") {
              // TODO a bit hacky
              if (sMethod === "height") {
                e.set(sMethod, (100 - convert(62, avail)) + "%")
              } else {
                e.set(sMethod, "100%")
              }
            } else if (type === "sidebar") {
              if (position === s1 || position === s2) {
                e.set(sMethod, "100%")
              } else if (position === s3 || position === s4) {
                e.set(sMethod, convert(size, avail) + "%")
              }
            }
          })
        }

        bindPos("left", "screen.available.width", ["size.popup.left", "size.popup.width"],
                false, "right")
        bindPos("top", "screen.available.height", ["size.popup.top", "size.popup.height"],
                true, "bottom")
        bindSize("width", "screen.available.width", ["size.popup.width", "size.bubble.width"],
                 "top", "bottom", "left", "right")
        bindSize("height", "screen.available.height", ["size.popup.height", "size.bubble.height"],
                 "left", "right", "top", "bottom")

        cell.bind([opt.get("popup.type"),
                   cache.get("screen.available.width"),
                   opt.get("size.sidebar.position")], function (type, width, position) {
          if (type === "bubble") {
            e.set("right", ((33 / width) * 100) + "%")
          } else if (type === "sidebar" && position === "right") {
            e.set("right", "0px")
          } else {
            e.set("right", "")
          }
        })

        cell.bind([opt.get("popup.type"),
                   opt.get("size.sidebar.position")], function (type, position) {
          if (type === "sidebar" && position === "bottom") {
            e.set("bottom", "0px")
          } else {
            e.set("bottom", "")
          }
        })

        cell.bind([opt.get("popup.type")], function (type) {
          if (type === "bubble") {
            e.set("border-radius", "3px")
          } else {
            e.set("border-radius", "")
          }
        })
      })


      lib.options.category(e, "Theme", function (e) {
        lib.options.checkbox(e, "theme.animation", {
          text: "Animation enabled"
        })

        lib.options.separator(e)

        dom.box(function (e) {
          e.styles(dom.horiz)

          e.addText("Color... ")

          lib.options.list(e, "theme.color", {
            items: [{
              group: "Color",
              items: [
                { name: "Blue",   value: "blue"   },
                { name: "Green",  value: "green"  },
                { name: "Yellow", value: "yellow" },
                { name: "Orange", value: "orange" },
                { name: "Red",    value: "red"    },
                { name: "Purple", value: "purple" },
                { name: "Pink",   value: "pink"   }
              ]
            }, {
              group: "Grayscale",
              items: [
                { name: "Black", value: "black" },
                { name: "Grey",  value: "grey"  },
                { name: "White", value: "white" }
              ]
            }]
          })
        }).move(e)

        /*dom.box(function (e) {
          e.border(function (t) {
            t.size("1px")
            t.rounded("2px")
            t.color("black")
          })
          e.width("5em")
          e.height("5em")
          e.margin(function (t) {
            t.top("0.25em")
            t.right("0.25em")
          })
          e.bind([opt.get("theme.color")], function (hue) {
            e.background(function (t) {
              t.color(color.skew(hue, 100, 65))
            })
          })
        }).move(e)*/

        dom.iframe(function (e) {
          e.styles(preview)
          e.src("panel.html")
        }).move(e)

        /*dom.table(function (e) {
          dom.row(function (e) {
            dom.cell(function (e) {
              //e.rowspan(3)

            }).move(e)

            cell(e, function (e) {
              e.text("Hue: ")
            })

            cell(e, function (e) {
              lib.options.textbox(e, "theme.hue", {
                width: "2.5em",
                // 480  = 120
                // 20   = 20
                // 360  = 0
                // 0    = 0
                // -360 = 0
                // -700 = 20
                // -120 = 240
                // -380 = 340
                set: function (x) {
                  x = (+x) % 360
                  if (x < 0) {
                    return 360 + x
                  } else {
                    return x
                  }
                }
              })
            })
          }).move(e)

          dom.row(function (e) {
            cell(e, function (e) {
              e.text("Saturation: ")
            })

            cell(e, function (e) {
              lib.options.textbox(e, "theme.saturation", {
                width: "2.5em",
                set: function (x) {
                  return +x
                }
              })
            })
          }).move(e)

          dom.row(function (e) {
            cell(e, function (e) {
              e.text("Lightness: ")
            })

            cell(e, function (e) {
              lib.options.textbox(e, "theme.lightness", {
                width: "2.5em",
                set: function (x) {
                  return +x
                }
              })
            })
          }).move(e)
        }).move(e)*/
      })

      lib.options.category(e, "Groups", function (e) {
        lib.options.subgroup(e, "Display groups:", function (e) {
          lib.options.radio(e, "groups.layout", {
            items: [
              { name: "Vertically",   value: "vertical"   },
              { name: "Horizontally", value: "horizontal" },
              { name: "In a grid",    value: "grid"       }
            ]
          })
        })
      })

      lib.options.category(e, "Tabs", function (e) {
        dom.box(function (e) {
          e.styles(dom.horiz)

          e.addText("Sort tabs by... ")

          lib.options.list(e, "group.sort.type", {
            items: [
              { name: "Window",  value: "window"  },
              { name: "Group",   value: "group"   },
              { separator: true },
              { name: "Focused", value: "focused" },
              { name: "Created", value: "created" },
              { separator: true },
              { name: "URL",     value: "url"     },
              { name: "Name",    value: "name"    }
            ]
          })
        }).move(e)

        lib.options.separator(e)

        dom.box(function (e) {
          e.styles(dom.horiz)

          e.addText("Show the ")

          dom.image(function (e) {
            e.styles(closeButton)
            e.src("data/images/button-close.png")
            e.alt("close")
          }).move(e)

          e.addText(" button on the ")

          lib.options.list(e, "tabs.close.location", {
            items: [
              { name: "right", value: "right" },
              { name: "left",  value: "left"  }
            ]
          })

          e.addText(" side ")

          lib.options.list(e, "tabs.close.display", {
            items: [
              { name: "while hovering", value: "hover" },
              //o.item("of the focused tab", "focused") TODO
              { name: "of every tab",   value: "every" }
            ]
          })
        }).move(e)

        lib.options.separator(e)

        lib.options.subgroup(e, "Click behavior:", function (e) {
          lib.options.radio(e, "tabs.click.type", {
            items: [
              { name: "1 click to focus",                     value: "focus"        },
              { name: "1 click to select, 2 clicks to focus", value: "select-focus" }
            ]
          })
        })

        lib.options.separator(e)

        lib.options.checkbox(e, "tabs.close.duplicates", {
          text: "Automatically close duplicate tabs"
        })
      })

      lib.options.category(e, "Popup", function (e) {
        lib.options.subgroup(e, "Open the popup with:", function (e) {
          dom.box(function (e) {
            e.styles(dom.horiz)

            lib.options.checkbox(e, "popup.hotkey.ctrl", {
              text: "Ctrl / ⌘"
            })

            space.horiz("15px").move(e)

            lib.options.checkbox(e, "popup.hotkey.shift", {
              text: "Shift"
            })

            space.horiz("12px").move(e)

            lib.options.checkbox(e, "popup.hotkey.alt", {
              text: "Alt"
            })

            space.horiz("10px").move(e)

            lib.options.textbox(e, "popup.hotkey.letter", {
              width: "2em",
              set: function (x) {
                return util.string.upper(x)
              }
            })
          }).move(e)
        })

        /*lib.options.separator(e)

        dom.box(function (e) {
          e.styles(dom.horiz)

          lib.options.list(e, "popup.switch.action", function (o) {
            o.item("Minimize", "minimize")
            o.item("Close", "close")
            o.item("Show", "show")
          })

          dom.box(function (e) {
            e.text(" the popup ")
          }).move(e)

          lib.options.list(e, "popup.close.when", function (o) {
            o.item("when switching tabs", "switch-tab")
            o.item("when switching windows", "switch-window")
            o.item("when losing focus", "lose-focus")
          })
        }).move(e)*/

        /*lib.options.separator(e)

        lib.options.checkbox(e, "popup.close.escape", "Use the Escape key to close the popup")*/

        lib.options.separator(e)

        dom.box(function (e) {
          e.styles(popupContainer)

          dom.box(function (e) {
            e.styles(dom.horiz)

            e.addText("Open as a... ")

            lib.options.list(e, "popup.type", {
              items: [
                { name: "bubble",  value: "bubble"  },
                { name: "sidebar", value: "sidebar" },
                { name: "popup",   value: "popup"   },
                { name: "tab",     value: "tab"     }
              ]
            })

            dom.box(function (e) {
              // TODO dom.style for this ?
              e.styles(dom.stretch)
            }).move(e)

            lib.options.button(e, "Check monitor size", function () {
              // TODO
              /*chrome.runtime.sendMessage({ type: "checkMonitor" }, function () {
                alert("Success!")
              })*/
            // TODO dom.style, maybe ?
            }).style(function (e) {
              e.set("height", "20px")
            })
          }).move(e)

          dom.box(function (e) {
            e.styles(popupInnerContainer)

            dom.box(function (e) {
              e.styles(popupScreen)

              dom.box(function (e) {
                e.styles(popupVerticalLine)
              }).move(e)

              dom.box(function (e) {
                e.styles(popupHorizontalLine)
              }).move(e)

              dom.box(function (e) {
                e.styles(popupPopup)

                dom.table(function (e) {
                  e.styles(popupPopupTable)

                  dom.cell(function (e) {
                    e.styles(popupPopupText)

                    e.bind([opt.get("popup.type")], function (type) {
                      e.text(util.string.upper(type))
                    })
                  }).move(e)
                }).move(e)
              }).move(e)

              dom.box(function (e) {
                e.styles(popupWidthContainer)
                // o.zIndex   = "1"

                dom.box(function (e) {
                  e.styles(popupWidthText)

                  e.bind([cache.get("screen.available.width")], function (x) {
                    e.text(x + " px")
                  })
                }).move(e)
              }).move(e)

              dom.box(function (e) {
                e.styles(popupHeightContainer)
                // o.zIndex   = "1"

                dom.box(function (e) {
                  e.styles(popupHeightText)

                  e.bind([cache.get("screen.available.height")], function (x) {
                    e.text(x + " px")
                  })
                }).move(e)
              }).move(e)
            }).move(e)
          }).move(e)

          function makeControls(s, f) {
            dom.table(function (e) {
              e.styles(popupControlTable)

              array.push(controls, e)

              e.bind([opt.get("popup.type")], function (type) {
                e.visible.set(type === s)
              })

              f(e)
            }).move(e)
          }

          function toNum(s) {
            return +s
          }

          function text(s) {
            return dom.box(function (e) {
              e.styles(popupControlText)
              e.text(s)
            })
          }

          function textControl(l, sOpt, r, info) {
            return dom.box(function (e) {
              e.styles(dom.horiz)

              text(l).move(e)

              info.type = "number"

              // TODO
              lib.options.textbox(e, sOpt, info).style(function (e) {
                e.set(["margin-left", "margin-right"], "3px")
              })

              e.addText(r)
            })
          }

          function makeRows(e) {
            var a = array.slice(arguments, 1)
            array.each(a, function (a) {
              dom.row(function (e) {
                array.each(a, function (x) {
                  dom.cell(function (e) {
                    e.styles(popupControlCell)
                    x.move(e)
                  }).move(e)
                })
              }).move(e)
            })
          }


          // TODO this whole system is wonky
          makeControls("popup", function (e) {
            function get(s) {
              return math.round((s * 200) - 100)
            }
            function set(s) {
              return (toNum(s) + 100) / 200
            }

            makeRows(e, [textControl("Left:", "size.popup.left", "%", {
                           width: "2em",
                           get: get,
                           set: set
                         }),
                         space.horiz("15px"),
                         textControl("Width:", "size.popup.width", "px", {
                           set: toNum
                         })],
                        [textControl("Top:", "size.popup.top", "%", {
                           width: "2em",
                           get: get,
                           set: set
                         }),
                         space.horiz("15px"),
                         textControl("Height:", "size.popup.height", "px", {
                           set: toNum
                         })])
          })

          makeControls("bubble", function (e) {
            makeRows(e, [textControl("Width:", "size.bubble.width", "px", {
                           set: toNum
                         })],
                        [textControl("Height:", "size.bubble.height", "px", {
                           set: toNum
                         })])
          })

          makeControls("sidebar", function (e) {
            /*eList.margin(function (t) {
              t.top("-3px")
            })*/
            /*eList.position(function (t) {
              t.top("-1px")
            })*/
            makeRows(e, [textControl("Size:", "size.sidebar", "px", {
                           set: toNum
                         }),
                         space.horiz("25px"),
                         text("Position: "),
                         lib.options.list(e, "size.sidebar.position", {
                           items: [
                             { name: "Left",   value: "left"   },
                             { name: "Right",  value: "right"  },
                             { name: "Top",    value: "top"    },
                             { name: "Bottom", value: "bottom" }
                           ]
                         })])
          })

          makeControls("tab", function () {})
        }).move(e)
      })

      /*lib.options.category(e, "Privacy", function (e) {
        e.width(containerWidth + "px")

        lib.options.subgroup(e, "Usage tracking:", function (e) {
          dom.box(function (e) {
            e.text("By default, we track how frequently you open the popup and options page, and also what settings you have chosen in the options page.")
          }).move(e)

          dom.box(function (e) {
            e.height("1em")
          }).move(e)

          dom.box(function (e) {
            e.text("This information is anonymous and is used solely to improve Tab Organizer.")
          }).move(e)

          dom.box(function (e) {
            e.height("1em")
          }).move(e)

          dom.box(function (e) {
            e.styles(dom.horiz)

            dom.box(function (e) {
              e.text("You can learn more about what we track ")
            }).move(e)

            dom.link(function (e) {
              e.src("http://documentation.tab-organizer.googlecode.com/hg/Tab%20Organizer%20FAQ.html#can-you-explain-usage-tracking")
              e.text("here")
            }).move(e)

            dom.box(function (e) {
              e.text(".")
            }).move(e)
          }).move(e)

          dom.box(function (e) {
            e.height("1.25em")
          }).move(e)

          lib.options.checkbox(e, "usage-tracking", "Allow for usage tracking")
        })
      })*/

      lib.options.category(e, "User Data", function (e) {
        dom.box(function (e) {
          e.styles(dom.horiz)

          // TODO
          /*lib.options.button(e, "Export", function () {
            chrome.runtime.sendMessage({ type: "db.export" }, function (s) {
              s = JSON.stringify(s, null, 2)
              s = new Blob([s], { type: "application/json" })
              s = URL.createObjectURL(s)

              dom.link(function (e) {
                // "data:application/json," + encodeURIComponent(s)
                e.src(s)
                e.download("Tab Organizer - User Data.json")
                e.click()
                //URL.revokeObjectURL(s)
              })
            })
          })

          space.horiz("10px").move(e)

          lib.options.button(e, "Import", function () {
            dom.file(function (e) {
              e.accept("application/json")
              e.event([e.changed], function (s) {
                chrome.runtime.sendMessage({ type: "db.import", value: JSON.parse(s) }, function () {
                  alert("Success!")
                })
              })
              e.click()
            })
          })

          space.horiz("20px").move(e)*/

          lib.options.button(e, "Reset options to default", function () {
            if (confirm("Are you sure?\n\nThis will reset all options to default.\n\nThis cannot be undone.\n\nThis does NOT reset tabs, groups, or macros.")) {
              opt.reset()
              cache.reset()
            }
          })
        }).move(e)
      })
    })

    // TODO hacky
    ;(function () {
      var maxHeight = 0

      array.each(controls, function (e) {
        var b = e.visible.get()
        e.visible.set(true)
        maxHeight = math.max(maxHeight, e.getPosition().height)
        e.visible.set(b)
      })

      array.each(controls, function (e) {
        e.style(function (e) {
          e.set("height", maxHeight + "px")
        })
      })
    })()
  })
})
