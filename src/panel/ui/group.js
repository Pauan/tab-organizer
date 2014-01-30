define("group-ui", function (require, exports) {
  "use strict";

  var name           = require("lib/util/name")
    , cell           = require("lib/util/cell")
    , ui             = require("lib/util/ui")
    , iter           = require("lib/util/iter")
    , menu_button_ui = require("menu-button-ui")
    , group_menu_ui  = require("group-menu-ui")
    , common_ui      = require("common-ui")
    , animate        = require("animate")
    , opt            = require("opt")
    , layout_ui      = require("layout-ui")

  var info = new name.Name()


  var hiddenGroup = animate.object({
    borderTopWidth: "0px",
    // TODO code duplication with "tab-ui"
    //paddingLeft: "15px",
    opacity: "0"
  })

  var hiddenGroupTop = animate.object({
    height: "0px"
  })

  var hiddenGroupTopInner = animate.object({
    paddingTop: "0px"
  })

  var hiddenGroupTabs = animate.object({
    paddingBottom: "0px"
  })


  var group = ui.style(function (e) {
    e.styles(ui.clip)
  })

  var groupTop = ui.style(function (e) {
    e.set("font-size", "11px")
    e.set("height", "16px") // TODO I don't like this hardcoding, but it's to avoid using ui.vert, which is slow (?)
  })

  var groupTopInner = ui.style(function (e) {
    e.styles(ui.horiz)
    e.set("padding-top", "1px") // TODO this needs to be animated
    e.set("padding-left", "4px")
  })

  var groupTabs = ui.style(function (e) {
    e.set("padding-bottom", "2px")
  })


  exports.hide = function (e, i) {
    animate.to(e[info].groupTop, i, hiddenGroupTop)
    animate.to(e[info].groupTopInner, i, hiddenGroupTopInner)
    animate.to(e[info].groupTabs, i, hiddenGroupTabs)
    animate.to(e, i, hiddenGroup, function () {
      e.remove()
    })
  }

  // TODO this isn't very smooth... I wonder why?
  exports.show = function (e, i) {
    // TODO use TweenTimeline ?
    animate.from(e[info].groupTop, i, hiddenGroupTop)
    animate.from(e[info].groupTopInner, i, hiddenGroupTopInner)
    animate.from(e[info].groupTabs, i, hiddenGroupTabs)
    animate.from(e, i, hiddenGroup)
  }

  exports.make = function (sTitle, oGroup, f) {
    return ui.box(function (eTop) {
      eTop[info] = {}

      eTop.styles(group, common_ui.group)
      //eTop.clip(true) // TODO is this ever necessary ?

      /*e.background(function (t) {
        t.color("inherit") // TODO
        t.image("inherit") // TODO
      })*/

      eTop.bind([opt.get("groups.layout")], function (layout) {
        eTop.styleObject(layout_ui.group, layout, true)
      })
      eTop.bind([opt.get("groups.layout"), eTop.focused], function (layout, focused) {
        eTop.styleObject(layout_ui.groupFocused, layout, focused)
      })

      ui.box(function (e) {
        eTop[info].groupTop = e

        e.styles(groupTop)

        e.bind([opt.get("groups.layout")], function (layout) {
          e.styleObject(layout_ui.groupTop, layout, true)
        })

        ui.box(function (e) {
          eTop[info].groupTopInner = e

          e.styles(groupTopInner)

          e.bind([opt.get("groups.layout")], function (layout) {
            e.styleObject(layout_ui.groupTopInner, layout, true)
          })

          ui.box(function (e) {
            // TODO ui.style for this one
            e.styles(ui.stretch, ui.clip)

            e.bind([sTitle], function (s) {
              e.text(s)
            })
          }).move(e)

          menu_button_ui.make(group_menu_ui.menu, function () {
            var normal   = []
              , selected = []
            iter.each(oGroup.aTabs, function (x) {
              x = x.info
              if (x.isVisible) {
                if (x.selected) {
                  selected.push(x)
                } else {
                  normal.push(x)
                }
              }
            })
            group_menu_ui.state.set({ normal: normal, selected: selected })
          }).move(e)
        }).move(e)
      }).move(eTop)

      ui.box(function (e) {
        eTop[info].groupTabs = e

        e.styles(groupTabs)

        e.bind([opt.get("groups.layout")], function (layout) {
          e.styleObject(layout_ui.groupTabs, layout, true)
        })
        f(e)
      }).move(eTop)
    })
  }
})
