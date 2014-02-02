goog.provide("menus.group")

goog.require("util.cell")
goog.require("util.array")
goog.require("ui.menu")
goog.require("menus.tab")

goog.scope(function () {
  var cell  = util.cell
    , array = util.array

  menus.group.state = cell.value({ selected: [], normal: [] })

  menus.group.menu = ui.menu.make(function (o) {
    //menu.separator(o)

    ui.menu.submenu(o, menus.tab.menu, function (o) {
      o.bind([menus.group.state], function (state) {
        if (array.len(state.selected)) {
          menus.tab.state.set({ tabs: state.selected })
          o.text("Selected tabs in group...")
        } else {
          o.text("All tabs in group...")
          if (array.len(state.normal)) {
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
