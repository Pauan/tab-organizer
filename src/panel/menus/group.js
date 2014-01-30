goog.provide("menus.group")

goog.require("util.cell")
goog.require("menu")
goog.require("menus.tab")

goog.scope(function () {
  var cell = util.cell

  menus.group.state = cell.value({ selected: [], normal: [] })

  menus.group.menu = menu.make(function (o) {
    //menu.separator(o)

    menu.submenu(o, menus.tab.menu, function (o) {
      o.bind([menus.group.state], function (state) {
        if (state.selected.length) {
          menus.tab.state.set({ tabs: state.selected })
          o.text("Selected tabs in group...")
        } else {
          o.text("All tabs in group...")
          if (state.normal.length) {
            menus.tab.state.set({ tabs: state.normal })
            o.enabled.set(true)
          } else {
            o.enabled.set(false)
          }
        }
      })
    })
  })
})
