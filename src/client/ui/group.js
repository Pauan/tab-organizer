goog.provide("ui.group")

goog.require("util.Symbol")
goog.require("util.cell")
goog.require("util.dom")
goog.require("util.array")
goog.require("util.log")
goog.require("ui.animate")
goog.require("ui.common")
goog.require("ui.layout")
goog.require("menus.group")
goog.require("menus.button")
goog.require("opt")

goog.scope(function () {
  var Symbol = util.Symbol
    , cell   = util.cell
    , dom    = util.dom
    , array  = util.array
    , log    = util.log.log
    , assert = util.log.assert

  var info = Symbol("info")

  var hiddenGroup = ui.animate.object({
    "borderTopWidth": "0px",
    // TODO code duplication with "tab-ui"
    //paddingLeft: "15px",
    "opacity": "0"
  })

  var hiddenGroupTop = ui.animate.object({
    "height": "0px"
  })

  var hiddenGroupTopInner = ui.animate.object({
    "paddingTop": "0px"
  })

  var hiddenGroupTabs = ui.animate.object({
    "paddingBottom": "0px"
  })


  var group = dom.style(function (e) {
    e.styles(dom.clip)
  })

  var groupTop = dom.style(function (e) {
    e.set("height", "16px") // TODO I don't like this hardcoding, but it's to avoid using ui.vert, which is slow (?)
  })

  var groupText = dom.style(function (e) {
    e.styles(dom.stretch, dom.clip)
    e.set("font-size", "11px")
  })

  var groupTopInner = dom.style(function (e) {
    e.styles(dom.horiz)
    e.set("padding-top", "1px") // TODO this needs to be animated
    e.set("padding-left", "4px")
  })

  var groupTabs = dom.style(function (e) {
    e.set("padding-bottom", "2px")
  })


  ui.group.hide = function (e, i) {
    ui.animate.to(e[info].groupTop, i, hiddenGroupTop)
    ui.animate.to(e[info].groupTopInner, i, hiddenGroupTopInner)
    ui.animate.to(e[info].groupTabs, i, hiddenGroupTabs)
    ui.animate.to(e, i, hiddenGroup, function () {
      e.remove()
    })
  }

  // TODO this isn't very smooth... I wonder why?
  ui.group.show = function (e, i) {
    // TODO use TweenTimeline ?
    ui.animate.from(e[info].groupTop, i, hiddenGroupTop)
    ui.animate.from(e[info].groupTopInner, i, hiddenGroupTopInner)
    ui.animate.from(e[info].groupTabs, i, hiddenGroupTabs)
    ui.animate.from(e, i, hiddenGroup)
  }

  ui.group.make = function (sTitle, oGroup, f) {
    assert(typeof oGroup.rename === "boolean")

    return dom.box(function (eTop) {
      eTop[info] = {}

      eTop.styles(group, ui.common.group)
      //eTop.clip(true) // TODO is this ever necessary ?

      /*e.background(function (t) {
        t.color("inherit") // TODO
        t.image("inherit") // TODO
      })*/

      eTop.bind([opt.get("groups.layout")], function (layout) {
        eTop.styleObject(ui.layout.group, layout, true)
      })
      // TODO why does this break group name renaming?
      /*eTop.bind([opt.get("groups.layout"), eTop.focused], function (layout, focused) {
        eTop.styleObject(ui.layout.groupFocused, layout, focused)
      })*/

      dom.box(function (e) {
        eTop[info].groupTop = e

        e.styles(groupTop)

        e.bind([opt.get("groups.layout")], function (layout) {
          e.styleObject(ui.layout.groupTop, layout, true)
        })

        dom.box(function (e) {
          eTop[info].groupTopInner = e

          e.styles(groupTopInner)

          e.bind([opt.get("groups.layout")], function (layout) {
            e.styleObject(ui.layout.groupTopInner, layout, true)
          })

          var rename
          if (oGroup.rename) {
            rename = dom.textbox(function (e) {
              e.styles(groupText)

              e.bind([sTitle], function (s) {
                e.value.set(s)
              })
              e.event([e.changed], function (s) {
                sTitle.set(s)
              })
            }).move(e)
          } else {
            rename = false
            dom.box(function (e) {
              // TODO dom.style for this one
              e.styles(dom.stretch, dom.clip)

              e.bind([sTitle], function (s) {
                e.text(s)
              })
            }).move(e)
          }

          menus.button.make(menus.group.menu, function () {
            var normal   = []
              , selected = []
            array.each(oGroup.aTabs, function (x) {
              x = x.info
              if (x.visible) {
                if (x.selected) {
                  array.push(selected, x)
                } else {
                  array.push(normal, x)
                }
              }
            })
            menus.group.state.set({
              normal: normal,
              selected: selected,
              rename: rename
            })
          }).move(e)
        }).move(e)
      }).move(eTop)

      dom.box(function (e) {
        eTop[info].groupTabs = e

        e.styles(groupTabs)

        e.bind([opt.get("groups.layout")], function (layout) {
          e.styleObject(ui.layout.groupTabs, layout, true)
        })
        f(e)
      }).move(eTop)
    })
  }
})
