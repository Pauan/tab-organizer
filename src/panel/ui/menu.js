define("menu", function (require, exports) {
  "use strict";

  var ui        = require("lib/util/ui")
    , name      = require("lib/util/name")
    , cell      = require("lib/util/cell")
    , iter      = require("lib/util/iter")
    , common_ui = require("common-ui")
    , animate   = require("animate")

  var element  = new name.Name()
    , children = new name.Name()
    , selected = new name.Name()
    , size     = new name.Name()

  var menus = []

  var eParent = cell.dedupe(false)

  /*var modalHidden = animate.object({
    opacity: "0"
  })*/

  var menuHidden = animate.object({
    scale: 0.75,
    opacity: "0"
  })

  var modalStyle = ui.style(function (e) {
    e.styles(ui.fixedPanel)
    e.set("top", "0px")
    e.set("left", "0px")
    e.set("width", "100%")
    e.set("height", "100%")
    e.set("background-color", ui.hsl(0, 0, 0, 0.15))
  })

  var itemStyle = ui.style(function (e) {
    e.styles(ui.horiz, common_ui.normal)
    e.set("margin", "-1px")
    e.set(["padding-top", "padding-bottom"], "1px")
  })

  var itemClickStyle = ui.style(function (e) {
    e.set("padding-top", "2px")
    e.set("padding-bottom", "0px")
  })

  var itemDisabled = ui.style(function (e) {
    e.set("color", ui.hsl(0, 0, 0, 0.2))
    e.set("cursor", "default") // TODO is this correct ?
  })

  var itemTextStyle = ui.style(function (e) {
    e.styles(ui.stretch, ui.clip)
    e.set(["padding-left", "padding-right"], "5px")
  })

  var menuStyle = ui.style(function (e) {
                            // TODO
    e.styles(ui.fixedPanel, ui.clip, common_ui.background)
    e.set("white-space", "pre")
    e.set("border-width", "1px")
    e.set("border-color", "black")
  })

  var separatorStyle = ui.style(function (e) {
    e.set("margin", "2px 3px")
    // TODO code duplication with "lib/util/ui" module ?
    e.set("background-color", "gainsboro")
  })

  var checkboxCheckbox = ui.style(function (e) {
    e.set("margin-right", "2px")
  })

  var checkboxStyle = ui.style(function (e) {
    e.styles(common_ui.normal, itemStyle)
    e.set("padding-left", "3px")
    e.set("padding-right", "4px")
  })

  var submenuStyle = ui.style(function (e) {
    e.styles(ui.horiz, common_ui.normal, itemStyle)
    e.set("cursor", "default")
  })

  var submenuArrow = ui.style(function (e) {
    e.set(["width", "height"], "7px")
    e.set("margin-right", "2px")
  })

  var modal = ui.box(function (e) {
    e.styles(modalStyle)

    e.hide()

    e.event([e.mouseclick], function (click) {
      if (click.left) {
        exports.hide()
      }
    })

    cell.when(eParent, function (eParent) {
      e.move(eParent)
    })

    /*addEventListener("blur", function (e) {
      if (e.target === this) {
        n.hide()
      }
    }, true)*/
  })

  function hide1(o) {
    iter.each(o[children], function (x) {
      delete x[size]
    })

    var e = o[element]
    o.hiding = true
    animate.to(e, 0.2, menuHidden, function () {
      e.hide()
      delete o.hiding
    })
    hideSelected(o)
  }

  function show1(o, pos) {
    var e = o[element]

    //e.width("")
    e.style(function (e) {
      e.set("top", "")
      e.set("bottom", "")
      e.set("right", "")
      e.set("left", "")

      if (pos.top != null) {
        e.set("top", pos.top + "px")
      } else if (pos.bottom != null) {
        e.set("bottom", pos.bottom + "px")
      }

      if (pos.left != null) {
        e.set("left", pos.left + "px")
      } else if (pos.right != null) {
        e.set("right", pos.right + "px")
      }
    })

    /*iter.each(o[children], function (x) {
      x.visible.set()
    })*/

    menus.push(o)
    delete o.hiding
    e.show()

    // Corrects the position if it's out of bounds
    var ePos = e.getPosition()
    e.style(function (e) {
      if (ePos.width > ui.width()) {
        e.set("left", "0px")
        e.set("right", "0px")
      } else if (ePos.left < 0) {
        e.set("left", "0px")
        e.set("right", "")
      } else if (ePos.right > ui.width()) {
        e.set("left", "")
        e.set("right", "0px")
      }

      if (ePos.height > ui.height()) {
        e.set("top", "0px")
        e.set("bottom", "0px")
      } else if (ePos.top < 0) {
        e.set("top", "0px")
        e.set("bottom", "")
      } else if (ePos.bottom > ui.height()) {
        e.set("top", "")
        e.set("bottom", "0px")
      }
    })

    // TODO not sure if this is the right behavior or not
    /*e.style(function (o) {
      o.set("width", e.getPosition().width + "px")
    })*/

    iter.each(o[children], function (x) {
      x[size] = x[element].getPosition()
    })

    animate.from(e, 0, menuHidden) // TODO a little ew, but probably necessary
  }

  // TODO a bit ew how it accepts 2 arguments
  function hideMenus(parent, parent2) {
    while (menus.length) {
      var x = menus[menus.length - 1]
      if (x === parent || x === parent2) {
        break
      } else {
        hide1(x)
        menus.pop()
      }
    }
    hideSelected(parent)
    hideSelected(parent2)
  }

  function showSelected(parent, o) {
    parent[selected] = o

    var e = o[element]
    // TODO this seems a little bit hacky
    e.styleWhen(common_ui.hover, true)
    e.styleWhen(common_ui.click, false)
  }

  function hideSelected(o) {
    var e = o[selected]
    if (e != null) {
      delete o[selected]

      e = e[element]
      // TODO this seems a little bit hacky
      e.styleWhen(common_ui.hover, false)
      e.styleWhen(common_ui.click, false)
    }
  }

  function maker(e, s) {
    return function () {
      return e[s].apply(e, arguments)
    }
  }

  exports.hide = function () {
    /*animate.to(modal, 0.2, modalHidden, function () {
      modal.hide()
    })*/
    modal.hide()
    iter.each(menus, function (o) {
      hide1(o)
    })
    menus = []
  }

  exports.show = function (e, pos) {
    exports.hide()
    modal.show()
    //animate.from(modal, 0.2, modalHidden)
    show1(e, pos)
  }

  function itemInit(eParent, e) {
    var o = {}
    o[element] = e
    eParent[children].push(o)

    o.styleWhen = maker(e, "styleWhen")
    //o.style     = maker(e, "style")
    o.dom       = maker(e, "dom")
    o.bind      = maker(e, "bind")
    o.event     = maker(e, "event")

    // TODO hacky
    o.moveBefore = function (x) {
      // TODO is this correct?
      if (x) {
        e.moveBefore(eParent[element], x[element])
      } else {
        e.move(eParent[element])
      }
    }

    o.enabled = cell.dedupe(true, {
      set: function (self, enabled) {
        e.styleWhen(itemDisabled, !enabled)
      }
    })

    return o
  }

  function itemText(o, e) {
    return ui.box(function (e) {
      e.styles(itemTextStyle)
      o.text = maker(e, "text")
    }).move(e)
  }

  function itemHover(eParent, e, o) {
    e.event([o.enabled, e.mouseover], function (enabled, over) {
      var b = !eParent.hiding && enabled && over
      if (b) {
        hideMenus(eParent, eParent)
      }
      e.styleWhen(common_ui.hover, b)
    })
    e.event([o.enabled, e.mouseover, e.mousedown], function (enabled, over, down) {
      var b = !eParent.hiding && enabled && over && down.left
      e.styleWhen(common_ui.click, b)
      e.styleWhen(itemClickStyle, b)
    })
  }

  exports.make = function (f) {
    /*return $.add(document.body, "div", function (e) {
      $.addClass(e, "menu")
      e._hidden = true
      $.hide(e)
      f(e)
    })*/

    var o = {}

    ui.box(function (e) {
      e.styles(menuStyle)

      o[element]  = e
      o[children] = []

      // TODO code duplication
      o.bind  = maker(e, "bind")
      o.event = maker(e, "event")

      e.hide()

      cell.when(eParent, function (eParent) {
        e.move(eParent)
      })
    })

    f(o)
    return o
  }

  exports.separator = function (eParent, f) {
    ui.separator(function (e) {
      e.styles(separatorStyle)

      var o = {}

      // TODO a little hacky ?
      o.hide = maker(e, "hide")
      o.show = maker(e, "show")

      // TODO code duplication
      o.bind  = maker(e, "bind")
      o.event = maker(e, "event")

      if (f != null) {
        f(o)
      }
    }).move(eParent[element])
  }

  exports.item = function (eParent, f) {
    ui.box(function (e) {
      e.styles(itemStyle)

      var o = itemInit(eParent, e)
      itemHover(eParent, e, o)
      itemText(o, e)

      o.activate = cell.value(undefined, {
        bind: function (oCell) {
          // TODO is this correct; does it leak; is it inefficient; can it be replaced with cell.filter ?
          return e.event([e.mouseclick], function (click) {
            // TODO ew
            if (o.enabled.get()) {
              if (click.left) {
                oCell.set()
              }
            }
          })
        },
        unbind: function (e) {
          e.unbind()
        }
      })

      f(o)
    }).move(eParent[element])
  }

  exports.checkbox = function (eParent, f) {
    ui.label(function (e) {
      e.styles(checkboxStyle)

      var o = itemInit(eParent, e)
      itemHover(eParent, e, o)

      ui.checkbox(function (e) {
        e.styles(checkboxCheckbox)

        o.checked = e.checked

        // TODO is this correct ?
        o.activate = cell.filter(e.changed.get(), e.changed, function () {
          return o.enabled.get()
        })
      }).move(e)

      // TODO
      itemText(o, e).style(function (e) {
        e.set(["padding-left", "padding-right"], "0px")
      })

      /*o.addText = function (s) {
        return e.addText(s)
      }*/

      /*
      // TODO ew
      o.resetStyles = function () {
        e.border(function (t) {
          t.size("1px")
        })
        e.padding(function (t) {
          t.horizontal("2px")
        })
      }*/

      o.remove = maker(e, "remove")

      f(o)
    }).move(eParent[element])
  }

  exports.submenu = function (eParent, eMenu, f) {
    ui.box(function (e) {
      e.styles(submenuStyle)

      var o = itemInit(eParent, e)
      itemText(o, e)

      ui.image(function (e) {
        e.styles(submenuArrow)
        e.src("images/chevron-small-right.png")
        //o.marginTop = "5px"
        //o.marginLeft = "2px"
      }).move(e)

      e.event([e.mouseover, o.enabled], function (over, enabled) {
        if (!eParent.hiding && enabled && over) {
          // This makes sure submenus stay open when hovering over this
          if (/*eParent[selected] !== o && */o[size] != null) {
            hideMenus(eParent, eMenu)
            showSelected(eParent, o)
            show1(eMenu, { top: o[size].top, right: ui.width() - o[size].left - 1 })
          }
        }
      })

      f(o)
    }).move(eParent[element])
  }

  exports.initialize = function (e) {
    eParent.set(e)
  }
})
