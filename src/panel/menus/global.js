goog.provide("menus.global")

goog.require("menus.tab")
goog.require("menus.option")
goog.require("util.cell")
goog.require("ui.menu")
goog.require("opt")

goog.scope(function () {
  var cell = util.cell

  menus.global.state = cell.value({ selected: [], normal: [] })

  menus.global.menu = ui.menu.make(function (o) {
    menus.option.make(o, "Sort tabs by...", "group.sort.type", [
      ["Window", "window"],
      ["Group", "group"],
      [],
      ["Focused", "focused"],
      ["Created", "created"],
      [],
      ["URL", "url"],
      ["Name", "name"]
    ])

    ui.menu.separator(o)

    ui.menu.item(o, function (o) {
      o.text("Move tabs based on sort")

      o.event([o.activate], function () {
        // TODO remove this once undo is implemented
        if (confirm("Are you sure? This will rearrange the tabs in Chrome and cannot be undone.")) {
          cell.when(opt.loaded, function () {
            //tabs.moveBasedOnSort(opt.get("group.sort.type").get())
          })
          ui.menu.hide()
        }
      })
    })

    ui.menu.separator(o)

    ui.menu.submenu(o, menus.tab.menu, function (o) {
      o.bind([menus.global.state], function (state) {
        if (state.selected.length) {
          o.text("All selected tabs...")
          menus.tab.state.set({ tabs: state.selected })
          o.enabled.set(true)
        } else {
          o.text("All tabs...")
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
