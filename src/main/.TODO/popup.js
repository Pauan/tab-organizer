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
 */
goog.provide("popup")

goog.require("util.cell")
goog.require("platform.port")
goog.require("tabs")
goog.require("cache")
goog.require("opt")
goog.require("goog.array")
goog.require("platform.popup")

goog.scope(function () {
  var cell  = util.cell
    , array = goog.array
    , port  = platform.port

  popup.init = function () {
    cell.when(cell.and(tabs.loaded, cache.loaded, opt.loaded), function () {
      function checkMonitor(f) {
        platform.popup.getSize(function (left, top, width, height) {
          cache.get("screen.available.left").set(left)
          cache.get("screen.available.top").set(top)
          cache.get("screen.available.width").set(width)
          cache.get("screen.available.height").set(height)
          cache.get("screen.available.checked").set(true)
          if (f != null) {
            f()
          }
        })
      }

      function getSize(f) {
        var left   = cache.get("screen.available.left")
          , top    = cache.get("screen.available.top")
          , width  = cache.get("screen.available.width")
          , height = cache.get("screen.available.height")
        if (cache.get("screen.available.checked").get()) {
          f(left.get(), top.get(), width.get(), height.get())
        } else {
          //alert("Tab Organizer needs to check your monitor's size. This will take about 1 second.")
          checkMonitor(function () {
            f(left.get(), top.get(), width.get(), height.get())
          })
        }
      }

      chrome.runtime.onMessage.addListener(function (o, info, send) {
        if (o.type === "checkMonitor") {
          checkMonitor(function () {
            send()
          })
          return true
        }
      })


      var oWin  = null
        , oTab  = null
        , oType = null
        , oSize = null

      function movePopup(left, top, width, height) {
        if (oWin !== null && oWin.id != null) {
          platform.popup.move(oWin.id, left, top, width, height)
        }
      }

      function makePopup(left, top, width, height) {
        if (oWin === null) {
          oWin      = {}
          oWin.type = oType
          // TODO what if update/remove is called before the window is created ?
          platform.popup.create("panel.html", left, top, width, height, function (o) {
            oWin.id = o.id
          })
        } else {
          oWin.type = oType
          movePopup(left, top, width, height)
        }
      }

      function makeTab() {
        if (oTab === null) {
          oTab = {}
          // TODO what if update/remove is called before the window is created ?
          chrome.tabs.create({ url:    "data/panel.html"
                             , active: true }, function (o) {
            oTab.id       = o.id
            oTab.windowId = o.windowId
          })
        } else {
          if (oTab.id != null) {
            chrome.tabs.update(oTab.id, { active: true })
          }
          if (oTab.windowId != null) {
            chrome.windows.update(oTab.windowId, { focused: true })
          }
        }
      }

      function toAll(f) {
        chrome.windows.getAll({ populate: false }, function (a) {
          array.forEach(a, function (w) {
            f(w)
          })
        })
      }

      function resizeWindow(w, f) {
        if (oSize !== null) {
          if (w.type === "normal" && (w.state === "maximized" || w.state === "normal")) {
            chrome.windows.update(w.id, { top:    oSize.top
                                        , left:   oSize.left
                                        , width:  oSize.width
                                        , height: oSize.height
                                        , state:  "normal" }, function () {
              if (f != null) {
                f()
              }
            })
          }
        }
      }

      function unresizeWindow(e) {
        if (e.type === "normal" && e.state === "normal") {
          chrome.windows.update(e.id, { state: "maximized" })
        }
      }

      function removeAll() {
        if (oWin !== null) {
          if (oWin.id != null) {
            chrome.windows.remove(oWin.id)
          }
          oWin = null
        }
        if (oTab !== null) {
          if (oTab.id != null) {
            chrome.tabs.remove(oTab.id)
          }
          oTab = null
        }
      }

      function openPopup() {
        var type = opt.get("popup.type").get()
          , old  = oType

        oType = type
        if (old != null && old !== type) {
          if (old === "sidebar") {
            toAll(unresizeWindow)
            oSize = null
          }
          removeAll() // TODO is this correct?
        }

        if (type === "bubble") {
          // TODO should update oWin.type synchronously
          getSize(function (aLeft, aTop, aWidth) {
            var width  = opt.get("size.bubble.width").get()
              , height = opt.get("size.bubble.height").get()
            makePopup(Math.round(aLeft + aWidth - 33 - width),
                      Math.round(aTop + 62),
                      Math.round(width),
                      Math.round(height))
          })

        } else if (type === "popup") {
          // TODO should update oWin.type synchronously
          getSize(function (aLeft, aTop, aWidth, aHeight) {
            var left   = opt.get("size.popup.left").get()
              , top    = opt.get("size.popup.top").get()
              , width  = opt.get("size.popup.width").get()
              , height = opt.get("size.popup.height").get()
            makePopup(Math.round(aLeft + (aWidth  * left) - (width  * left)),
                      Math.round(aTop  + (aHeight * top)  - (height * top)),
                      Math.round(width),
                      Math.round(height))
          })

        } else if (type === "sidebar") {
          getSize(function (aLeft, aTop, aWidth, aHeight) {
            var size = opt.get("size.sidebar").get()
              , pos  = opt.get("size.sidebar.position").get()
              , o
            if (pos === "top") {
              o = {
                left:   Math.round(aLeft),
                top:    Math.round(aTop),
                width:  Math.round(aWidth),
                height: Math.round(size)
              }
              oSize = {
                left:   o.left,
                top:    Math.round(aTop + size),
                width:  o.width,
                height: Math.round(aHeight - size)
              }
            } else if (pos === "bottom") {
              o = {
                left:   Math.round(aLeft),
                top:    Math.round(aTop + aHeight - size),
                width:  Math.round(aWidth),
                height: Math.round(size)
              }
              oSize = {
                left:   o.left,
                top:    Math.round(aTop),
                width:  o.width,
                height: Math.round(aHeight - size)
              }
            } else if (pos === "left") {
              o = {
                left:   Math.round(aLeft),
                top:    Math.round(aTop),
                width:  Math.round(size),
                height: Math.round(aHeight)
              }
              oSize = {
                left:   Math.round(aLeft + size),
                top:    o.top,
                width:  Math.round(aWidth - size),
                height: o.height
              }
            } else if (pos === "right") {
              o = {
                left:   Math.round(aLeft + aWidth - size),
                top:    Math.round(aTop),
                width:  Math.round(size),
                height: Math.round(aHeight)
              }
              oSize = {
                left:   Math.round(aLeft),
                top:    o.top,
                width:  Math.round(aWidth - size),
                height: o.height
              }
            }
            makePopup(o.left, o.top, o.width, o.height)
            toAll(resizeWindow)
          })

        } else if (type === "tab") {
          makeTab()
        }
      }

      cell.bind([opt.get("popup.type")], function (type) {
        if (type === "bubble") {
          chrome.browserAction.setPopup({ popup: "data/panel.html" })
        } else {
          chrome.browserAction.setPopup({ popup: "" })
        }
      })

      chrome.browserAction.setTitle({ title: "Tab Organizer" })
      chrome.browserAction.setIcon({ path: "data/icons/icon19.png" })
      chrome.browserAction.onClicked.addListener(function () {
        openPopup()
      })

      chrome.windows.onCreated.addListener(function (w) {
        if (oWin !== null && oWin.type === "sidebar") {
          resizeWindow(w, function () {
            setTimeout(function () {
              resizeWindow(w)
            }, 100)
          })
        }
      })

      chrome.windows.onRemoved.addListener(function (id) {
        if (oWin !== null && oWin.id != null && oWin.id === id) {
          if (oWin.type === "sidebar") {
            toAll(unresizeWindow)
            oSize = null
          }
          oWin = null
        }
      })

      chrome.tabs.onRemoved.addListener(function (id) {
        if (oTab !== null && oTab.id != null && oTab.id === id) {
          oTab = null
        }
      })

      chrome.tabs.onDetached.addListener(function (i) {
        if (oTab !== null && oTab.id != null && oTab.id === i) {
          delete oTab.windowId
        }
      })

      chrome.tabs.onAttached.addListener(function (i, info) {
        if (oTab !== null && oTab.id != null && oTab.id === i) {
          oTab.windowId = info.newWindowId
        }
      })

      ;(function () {
        var ctrl   = opt.get("popup.hotkey.ctrl")
          , shift  = opt.get("popup.hotkey.shift")
          , alt    = opt.get("popup.hotkey.alt")
          , letter = opt.get("popup.hotkey.letter")
        cell.event([port.on.message("lib/keyboard")], function (e) {
          if (ctrl.get()   === e.ctrl &&
              shift.get()  === e.shift &&
              alt.get()    === e.alt &&
              letter.get() === String.fromCharCode(e.key).toUpperCase()) {
            openPopup()
          }
        })
      })()
    })
  }
})