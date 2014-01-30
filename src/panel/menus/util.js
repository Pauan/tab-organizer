goog.provide("menus.button")
goog.provide("menus.option")

goog.require("util.cell")
goog.require("util.array")
goog.require("util.ui")
goog.require("opt")
goog.require("menu")

goog.scope(function () {
  var cell  = util.cell
    , array = util.array
    , ui    = util.ui

  var bold = ui.style(function (o) {
    o.set("font-weight", "bold")
  })

  menus.option.make = function (oMenu, sName, sOpt, a) {
    var sub = menu.make(function (o) {
      cell.when(opt.loaded, function () {
        var x = opt.get(sOpt)
        array.each(a, function (a) {
          if (array.len(a) === 0) {
            menu.separator(o)
          } else {
            menu.item(o, function (e) {
              var val = a[1]

              e.text(a[0])

              // TODO could be made slightly more performant
              e.bind([x], function (x) {
                e.styleWhen(bold, x === val)
              })

              e.event([e.activate], function () {
                if (x.get() !== val) {
                  x.set(val)
                  menu.hide()
                }
              })
            })
          }
        })
      })
    })
    menu.submenu(oMenu, sub, function (o) {
      o.text(sName)
    })
  }
})

goog.scope(function () {
  var ui = util.ui

  var button = ui.style(function (e) {
    //e.set("width", "15px")
    e.set("height", "15px")
    e.set("padding-right", "1px")
  })

  menus.button.initialize = function (e, eMenu, f) {
    // TODO
    e.style(function (e) {
      e.set("cursor", "pointer")
    })

    e.event([e.mouseclick], function (click) {
      if (click.left) {
        f()
        var o = e.getPosition()
        menu.show(eMenu, { top: o.bottom - 3, right: ui.width() - o.right - 1 })
      }
    })
  }

  menus.button.make = function (eMenu, f) {
    return ui.image(function (e) {
      e.styles(button)
      e.src("images/menu-button.png")
      menus.button.initialize(e, eMenu, f)
    })
    /*$.add(x, "img", function (x) {
      $.addClass(x, "group-menu-button")
      $.setAttr(x, "src", "images/menu-button.png")
      $.on(x, "click", function () {
        $.menu.show(menu, e, { relativeTo: x })
      })
    })*/
  }
})
