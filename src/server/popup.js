/*
 !         -> tab     (opens tab)
 !         -> popup   (gets size, opens popup)
 !         -> sidebar (gets size, opens popup, resizes windows)
 !         -> bubble  (opens bubble)

 ! tab     -> tab     (focuses tab + window)
 ! popup   -> popup   (focuses popup)
 ! sidebar -> sidebar (focuses popup, resizes windows)
 ! bubble  -> bubble  (not possible, probably closes bubble)

 ! tab     ->         (nothing)
 ! popup   ->         (nothing)
 ! sidebar ->         (unresizes windows)
 ! bubble  ->         (nothing)

 ! tab     -> popup   (closes tab, opens popup)
 ! tab     -> sidebar (closes tab, opens popup, resizes windows)
 ! tab     -> bubble  (closes tab, opens bubble)

 ! popup   -> tab     (closes popup, opens tab)
 ! popup   -> sidebar (moves popup , resizes windows)
 ! popup   -> bubble  (closes popup, opens bubble)

 ! sidebar -> tab     (closes popup, unresizes windows, opens tab)
 ! sidebar -> popup   (moves popup , unresizes windows)
 ! sidebar -> bubble  (closes popup, unresizes windows, opens bubble)

 ! bubble  -> tab     (closes bubble?, opens tab)
 ! bubble  -> popup   (closes bubble?, opens popup)
 ! bubble  -> sidebar (closes bubble?, opens popup, resizes windows)


 current-type   -> new-type

 tab            -> tab             (focus tab)
 popup,sidebar  -> popup,sidebar   (focus popup)

 tab            -> !tab            (close tab)
 !tab           -> tab             (open tab)

 popup,sidebar  -> !popup,sidebar  (close popup)
 !popup,sidebar -> popup,sidebar   (open popup)

 tab            -> bubble          (close tab)
 popup,sidebar  -> bubble          (close popup)
 sidebar        -> bubble          (unresizes windows)

 sidebar        ->                 (unresizes windows)
 sidebar        -> !sidebar        (unresizes windows)
 *              -> sidebar         (resizes windows)

 */
goog.provide("popup")

goog.require("platform.manifest")
goog.require("platform.tabs")
goog.require("platform.windows")
goog.require("platform.popup")
goog.require("platform.port")
goog.require("platform.button")
goog.require("util.cell")
goog.require("util.log")
goog.require("util.array")
goog.require("tabs")
goog.require("cache")
goog.require("opt")

goog.scope(function () {
  var cell  = util.cell
    , array = util.array
    , log   = util.log.log
    , fail  = util.log.fail

  popup.init = function () {
    cell.when(cell.and(platform.tabs.loaded, platform.windows.loaded, tabs.loaded, cache.loaded, opt.loaded), function () {
      var avail = {
        left:    cache.get("screen.available.left"),
        top:     cache.get("screen.available.top"),
        width:   cache.get("screen.available.width"),
        height:  cache.get("screen.available.height"),
        checked: cache.get("screen.available.checked")
      }

      // TODO handle race conditions better, using cells
      function checkMonitor(f) {
        platform.popup.getSize(function (left, top, width, height) {
          avail.left.set(left)
          avail.top.set(top)
          avail.width.set(width)
          avail.height.set(height)
          avail.checked.set(true)
          f(left, top, width, height)
        })
      }

      function getSize(f) {
        if (avail.checked.get()) {
          f(avail.left.get(), avail.top.get(), avail.width.get(), avail.height.get())
        } else {
          //alert("Tab Organizer needs to check your monitor's size. This will take about 1 second.")
          checkMonitor(f)
        }
      }


      platform.port.onRequest("checkMonitor", function (_, send) {
        checkMonitor(function () {
          send(null)
        })
        return true
      })


      var oPopup  = null
        , oTab    = null
        , oldType = null
        , oSize   = null

      var type = opt.get("popup.type")

      function makePopup(oSize) {
        if (oPopup === null) {
          oPopup = platform.popup.open("panel.html", oSize)
        } else {
          platform.popup.move(oPopup, oSize)
        }
        oPopup.type = type.get()
      }

      // TODO
      function makeTab() {
        if (oTab === null) {
          // TODO what if update/remove is called before the tab is created ?
          platform.tabs.open("panel.html", false, function (t) {
            oTab = t
          })
        } else {
          platform.tabs.focus(oTab.id)
        }
      }

      function toAll(f) {
        array.each(platform.windows.getAll(), function (x) {
          f(x)
        })
      }

      function resizeWindow(w) {
        if (oSize !== null) {
          if (w.state === "maximized" || w.state === "normal") {
            platform.windows.move(w.id, oSize)
          }
        }
      }

      function unresizeWindow(w) {
        if (w.state === "normal") {
          platform.windows.maximize(w.id)
        }
      }

      function removeAll() {
        if (oPopup !== null) {
          platform.popup.close(oPopup)
          oPopup = null
        }
        if (oTab !== null) {
          platform.tabs.close(oTab.id)
          oTab = null
        }
      }

      function openPopup() {
        var newType = type.get()

        if (oldType !== null && oldType !== newType) {
          if (oldType === "sidebar") {
            toAll(unresizeWindow)
            oSize = null
          }
          removeAll() // TODO is this correct?
        }

        oldType = newType

        if (newType === "popup") {
          // TODO should update oWin.type synchronously
          getSize(function (aLeft, aTop, aWidth, aHeight) {
            var left   = opt.get("size.popup.left").get()
              , top    = opt.get("size.popup.top").get()
              , width  = opt.get("size.popup.width").get()
              , height = opt.get("size.popup.height").get()
            makePopup({ left:   aLeft + (aWidth  * left) - (width  * left),
                        top:    aTop  + (aHeight * top)  - (height * top),
                        width:  width,
                        height: height })
          })

        } else if (newType === "sidebar") {
          getSize(function (aLeft, aTop, aWidth, aHeight) {
            var size = opt.get("size.sidebar").get()
              , pos  = opt.get("size.sidebar.position").get()
              , o
            if (pos === "top") {
              o = {
                left:   aLeft,
                top:    aTop,
                width:  aWidth,
                height: size
              }
              oSize = {
                left:   o.left,
                top:    aTop + size,
                width:  o.width,
                height: aHeight - size
              }
            } else if (pos === "bottom") {
              o = {
                left:   aLeft,
                top:    aTop + aHeight - size,
                width:  aWidth,
                height: size
              }
              oSize = {
                left:   o.left,
                top:    aTop,
                width:  o.width,
                height: aHeight - size
              }
            } else if (pos === "left") {
              o = {
                left:   aLeft,
                top:    aTop,
                width:  size,
                height: aHeight
              }
              oSize = {
                left:   aLeft + size,
                top:    o.top,
                width:  aWidth - size,
                height: o.height
              }
            } else if (pos === "right") {
              o = {
                left:   aLeft + aWidth - size,
                top:    aTop,
                width:  size,
                height: aHeight
              }
              oSize = {
                left:   aLeft,
                top:    o.top,
                width:  aWidth - size,
                height: o.height
              }
            }
            makePopup(o)
            toAll(resizeWindow)
          })

        } else if (newType === "tab") {
          makeTab()

        } else {
          fail()
        }
      }

      cell.bind([type], function (type) {
        if (type === "bubble") {
          platform.button.setURL("panel.html")
        } else {
          platform.button.setURL("")
        }
      })

      cell.event([platform.button.on.clicked], function () {
        openPopup()
      })

      cell.event([platform.windows.on.created], function (w) {
        if (oPopup !== null && oPopup.type === "sidebar") {
          resizeWindow(w)
        }
      })

      cell.event([platform.popup.on.closed], function (popup) {
        if (popup.type === "sidebar") {
          toAll(unresizeWindow)
          oSize = null
        }
        oPopup = null
      })

      /*chrome.tabs.onRemoved.addListener(function (id) {
        if (oTab !== null && oTab.id != null && oTab.id === id) {
          oTab = null
        }
      })*/

      ;(function () {
        var ctrl   = opt.get("popup.hotkey.ctrl")
          , shift  = opt.get("popup.hotkey.shift")
          , alt    = opt.get("popup.hotkey.alt")
          , letter = opt.get("popup.hotkey.letter")
        cell.event([platform.port.on.message("lib/keyboard")], function (e) {
          if (ctrl.get()   === e["ctrl"] &&
              shift.get()  === e["shift"] &&
              alt.get()    === e["alt"] &&
              letter.get() === util.string.upper(util.string.fromUnicode(e["key"]))) {
            if (type.get() === "bubble") {
              // TODO should update oWin.type synchronously
              getSize(function (aLeft, aTop, aWidth) {
                var width  = opt.get("size.bubble.width").get()
                  , height = opt.get("size.bubble.height").get()
                makePopup({ left:   aLeft + aWidth - 33 - width,
                            top:    aTop + 62,
                            width:  width,
                            height: height })
              })
            } else {
              openPopup()
            }
          }
        })
      })()

      platform.button.setTitle(platform.manifest.get("name"))
      platform.button.setIconURL("data/icons/icon19.png")
    })
  }
})
