@ = require([
  { id: "sjs:sequence" },
  { id: "./extension/main" },
  { id: "./options" },
  { id: "./util/observe" }
])

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
exports.init = function () {
  var avail = {
    left:    @cache("screen.available.left"),
    top:     @cache("screen.available.top"),
    width:   @cache("screen.available.width"),
    height:  @cache("screen.available.height"),
    checked: @cache("screen.available.checked")
  }

  function checkMonitor() {
    var size = @windows.getMaximumSize(false)
    avail.left.set(size.left)
    avail.top.set(size.top)
    avail.width.set(size.width)
    avail.height.set(size.height)
    avail.checked.set(true)
    return size
  }

  function getSize() {
    // TODO use current or get ?
    if (avail.checked ..@current) {
      return {
        left: avail.left ..@current,
        top: avail.top ..@current,
        width: avail.width ..@current,
        height: avail.height ..@current
      }
    } else {
      return checkMonitor()
    }
  }

  console.log(checkMonitor())

  // TODO
  /*platform.port.onRequest("checkMonitor", function (_, send) {
    checkMonitor(function () {
      send(null)
    })
    return true
  })*/

  var type = @opt("popup.type")

  var tab_open   = null
  var popup_open = null

  var popup_type = null
  var popup_url  = "panel.html"

  function openPopup(size) {
    if (popup_open === null) {
      var o    = {}
      o.url    = popup_url
      o.left   = size.left
      o.top    = size.top
      o.width  = size.width
      o.height = size.height
      popup_open = @popup.open(o)
    } else {
      @popup.move(popup_open, size)
    }
    return popup_open
  }

  function makeTab() {
    if (tab_open === null) {
      tab_open = @tabs.open({ url: popup_url })
    } else {
      @tabs.focus(tab_open)
    }
    return tab_open
  }

  function toAll(f) {
    @windows.getCurrent() ..@each(function (x) {
      f(x)
    })
  }

  function resizeWindow(w) {
    if (oSize !== null) {
      // TODO move this into chrome/windows
      if (w.state === "maximized" || w.state === "normal") {
        @windows.move(w, oSize)
      }
    }
  }

  function unresizeWindow(w) {
    // TODO move this into chrome/windows
    if (w.state === "normal") {
      @windows.maximize(w)
    }
  }

  function removeAll() {
    if (popup_open !== null) {
      @popup.close(popup_open)
      popup_open = null
    }
    if (tab_open !== null) {
      @tabs.close(tab_open)
      tab_open = null
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

  type ..@observe(function (type) {
    if (type === "bubble") {
      @button.setURL(popup_url)
    } else {
      @button.setURL("")
    }
  })

  /*type.modify(function (curr) {
    console.log(curr)
    return "bubble"
  })
  console.log(type ..@current)
  type.set("bubble")*/

  /*cell.event([platform.button.on.clicked], function () {
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
  })*/

  /*chrome.tabs.onRemoved.addListener(function (id) {
    if (oTab !== null && oTab.id != null && oTab.id === id) {
      oTab = null
    }
  })*/

  /*;(function () {
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


  @button.setTooltip(@manifest.get("name"))
  // TODO dictionary of icon sizes
  @button.setIconURL("data/icons/icon19.png")*/

  console.info("popup: finished")
}
