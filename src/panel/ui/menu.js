goog.provide("ui.menu")

goog.require("util.dom")
goog.require("util.Symbol")
goog.require("util.cell")
goog.require("util.array")
goog.require("util.func")
goog.require("ui.common")
goog.require("ui.animate")

goog.scope(function () {
  var dom    = util.dom
    , Symbol = util.Symbol
    , cell   = util.cell
    , array  = util.array
    , func   = util.func

  var element  = Symbol("element")
    , children = Symbol("children")
    , selected = Symbol("selected")
    , size     = Symbol("size")

  var menus = []

  var eParent = cell.dedupe(false)

  /*var modalHidden = ui.animate.object({
    "opacity": "0"
  })*/

  var menuHidden = ui.animate.object({
    "scale": 0.75,
    "opacity": "0"
  })

  var modalStyle = dom.style(function (e) {
    e.styles(dom.fixedPanel)
    e.set("top", "0px")
    e.set("left", "0px")
    e.set("width", "100%")
    e.set("height", "100%")
    e.set("background-color", dom.hsl(0, 0, 0, 0.15))
  })

  var itemStyle = dom.style(function (e) {
    e.styles(dom.horiz, ui.common.normal)
    e.set("margin", "-1px")
    e.set(["padding-top", "padding-bottom"], "1px")
  })

  var itemClickStyle = dom.style(function (e) {
    e.set("padding-top", "2px")
    e.set("padding-bottom", "0px")
  })

  var itemDisabled = dom.style(function (e) {
    e.set("color", dom.hsl(0, 0, 0, 0.2))
    e.set("cursor", "default") // TODO is this correct ?
  })

  var itemTextStyle = dom.style(function (e) {
    e.styles(dom.stretch, dom.clip)
    e.set(["padding-left", "padding-right"], "5px")
  })

  var menuStyle = dom.style(function (e) {
                            // TODO
    e.styles(dom.fixedPanel, dom.clip, ui.common.background)
    e.set("white-space", "pre")
    e.set("border-width", "1px")
    e.set("border-color", "black")
  })

  var separatorStyle = dom.style(function (e) {
    e.set("margin", "2px 3px")
    // TODO code duplication with "lib/util/dom" module ?
    e.set("background-color", "gainsboro")
  })

  var checkboxCheckbox = dom.style(function (e) {
    e.set("margin-right", "2px")
  })

  var checkboxStyle = dom.style(function (e) {
    e.styles(ui.common.normal, itemStyle)
    e.set("padding-left", "3px")
    e.set("padding-right", "4px")
  })

  var submenuStyle = dom.style(function (e) {
    e.styles(dom.horiz, ui.common.normal, itemStyle)
    e.set("cursor", "default")
  })

  var submenuArrow = dom.style(function (e) {
    e.set(["width", "height"], "7px")
    e.set("margin-right", "2px")
  })

  var modal = dom.box(function (e) {
    e.styles(modalStyle)

    e.hide()

    e.event([e.mouseclick], function (click) {
      if (click.left) {
        ui.menu.hide()
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
    array.each(o[children], function (x) {
      delete x[size]
    })

    var e = o[element]
    o.hiding = true
    ui.animate.to(e, 0.2, menuHidden, function () {
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

    array.push(menus, o)
    delete o.hiding
    e.show()

    // Corrects the position if it's out of bounds
    var ePos = e.getPosition()
    e.style(function (e) {
      if (ePos.width > dom.width()) {
        e.set("left", "0px")
        e.set("right", "0px")
      } else if (ePos.left < 0) {
        e.set("left", "0px")
        e.set("right", "")
      } else if (ePos.right > dom.width()) {
        e.set("left", "")
        e.set("right", "0px")
      }

      if (ePos.height > dom.height()) {
        e.set("top", "0px")
        e.set("bottom", "0px")
      } else if (ePos.top < 0) {
        e.set("top", "0px")
        e.set("bottom", "")
      } else if (ePos.bottom > dom.height()) {
        e.set("top", "")
        e.set("bottom", "0px")
      }
    })

    // TODO not sure if this is the right behavior or not
    /*e.style(function (o) {
      o.set("width", e.getPosition().width + "px")
    })*/

    array.each(o[children], function (x) {
      x[size] = x[element].getPosition()
    })

    ui.animate.from(e, 0, menuHidden) // TODO a little ew, but probably necessary
  }

  // TODO a bit ew how it accepts 2 arguments
  function hideMenus(parent, parent2) {
    while (array.len(menus)) {
      var x = array.last(menus)
      if (x === parent || x === parent2) {
        break
      } else {
        hide1(x)
        array.pop(menus)
      }
    }
    hideSelected(parent)
    hideSelected(parent2)
  }

  function showSelected(parent, o) {
    parent[selected] = o

    var e = o[element]
    // TODO this seems a little bit hacky
    e.styleWhen(ui.common.hover, true)
    e.styleWhen(ui.common.click, false)
  }

  function hideSelected(o) {
    var e = o[selected]
    if (e != null) {
      delete o[selected]

      e = e[element]
      // TODO this seems a little bit hacky
      e.styleWhen(ui.common.hover, false)
      e.styleWhen(ui.common.click, false)
    }
  }

  function maker(e, s) {
    return function () {
      return func.apply(e[s], e, arguments)
    }
  }

  ui.menu.hide = function () {
    /*ui.animate.to(modal, 0.2, modalHidden, function () {
      modal.hide()
    })*/
    modal.hide()
    array.each(menus, function (o) {
      hide1(o)
    })
    menus = []
  }

  ui.menu.show = function (e, pos) {
    ui.menu.hide()
    modal.show()
    //ui.animate.from(modal, 0.2, modalHidden)
    show1(e, pos)
  }

  function itemInit(eParent, e) {
    var o = {}
    o[element] = e
    array.push(eParent[children], o)

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
    return dom.box(function (e) {
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
      e.styleWhen(ui.common.hover, b)
    })
    e.event([o.enabled, e.mouseover, e.mousedown], function (enabled, over, down) {
      var b = !eParent.hiding && enabled && over && down.left
      e.styleWhen(ui.common.click, b)
      e.styleWhen(itemClickStyle, b)
    })
  }

  ui.menu.make = function (f) {
    /*return $.add(document.body, "div", function (e) {
      $.addClass(e, "menu")
      e._hidden = true
      $.hide(e)
      f(e)
    })*/

    var o = {}

    dom.box(function (e) {
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

  /**
   * TODO stricter type
   * @param {!Object} eParent
   * @param {function(!Object):void=} f
   */
  ui.menu.separator = function (eParent, f) {
    dom.separator(function (e) {
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

  ui.menu.item = function (eParent, f) {
    dom.box(function (e) {
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

  ui.menu.checkbox = function (eParent, f) {
    dom.label(function (e) {
      e.styles(checkboxStyle)

      var o = itemInit(eParent, e)
      itemHover(eParent, e, o)

      dom.checkbox(function (e) {
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

  ui.menu.submenu = function (eParent, eMenu, f) {
    dom.box(function (e) {
      e.styles(submenuStyle)

      var o = itemInit(eParent, e)
      itemText(o, e)

      dom.image(function (e) {
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
            show1(eMenu, { top: o[size].top, right: dom.width() - o[size].left - 1 })
          }
        }
      })

      f(o)
    }).move(eParent[element])
  }

  ui.menu.initialize = function (e) {
    eParent.set(e)
  }
})
