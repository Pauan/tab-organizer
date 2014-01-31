goog.provide("menus.button")
goog.provide("menus.option")

goog.require("util.cell")
goog.require("util.array")
goog.require("util.dom")
goog.require("ui.menu")
goog.require("opt")

goog.scope(function () {
  var cell  = util.cell
    , array = util.array
    , dom   = util.dom

  var bold = dom.style(function (o) {
    o.set("font-weight", "bold")
  })

  menus.option.make = function (oMenu, sName, sOpt, a) {
    var sub = ui.menu.make(function (o) {
      cell.when(opt.loaded, function () {
        var x = opt.get(sOpt)
        array.each(a, function (a) {
          if (array.len(a) === 0) {
            ui.menu.separator(o)
          } else {
            ui.menu.item(o, function (e) {
              var val = a[1]

              e.text(a[0])

              // TODO could be made slightly more performant
              e.bind([x], function (x) {
                e.styleWhen(bold, x === val)
              })

              e.event([e.activate], function () {
                if (x.get() !== val) {
                  x.set(val)
                  ui.menu.hide()
                }
              })
            })
          }
        })
      })
    })
    ui.menu.submenu(oMenu, sub, function (o) {
      o.text(sName)
    })
  }
})

goog.scope(function () {
  var dom = util.dom

  var button = dom.style(function (e) {
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
        ui.menu.show(eMenu, { top: o.bottom - 3, right: dom.width() - o.right - 1 })
      }
    })
  }

  menus.button.make = function (eMenu, f) {
    return dom.image(function (e) {
      e.styles(button)
      e.src("data/images/menu-button.png")
      menus.button.initialize(e, eMenu, f)
    })
    /*$.add(x, "img", function (x) {
      $.addClass(x, "group-menu-button")
      $.setAttr(x, "src", "data/images/menu-button.png")
      $.on(x, "click", function () {
        $.menu.show(menu, e, { relativeTo: x })
      })
    })*/
  }
})
