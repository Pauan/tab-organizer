@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" },
  { id: "lib:util/util" },
  { id: "./util" },
  { id: "./url", name: "url" },
  { id: "./tabs/saved", name: "saved" },
  { id: "./tabs/async", name: "async" },
  { id: "./tabs/active", name: "active" }
])


var url_empty = @url.get("data/empty.html")


// Needed because Chrome sends an onCreated event before the tab/window is created, so we have to debounce it
var delayed_events = null

function delay(info) {
  if (delayed_events !== null) {
    delayed_events.push(info)
  } else {
    info.action()
  }
}


function openInternalWindow(info) {
  var a = (delayed_events = [])

  try {
    var window = @async.windows.create(info)
  } finally {
    delayed_events = null
  }

  var seen = false

  console.log(a)

  a ..@each(function (event) {
    if (event.window_id !== null && event.window_id === window.id) {
      if (event.type === "windows.onCreated") {
        @assert.is(seen, false)
        seen = true
      }
    } else {
      event.action()
    }
  })

  @assert.is(seen, true)

  return window
}


/**
 * Exported API
 */
exports.windows = {}
exports.windows.on = @active.windows.on
exports.windows.getCurrent = @active.windows.getCurrent

exports.tabs = {}
exports.tabs.on = @active.tabs.on

/*exports.tabs.has = function (id) {
  return tabs_id ..@has(id)
}

exports.tabs.get = function (id) {
  return tabs_id ..@get(id)
}

exports.windows.has = function (id) {
  return windows_id ..@has(id)
}

exports.windows.get = function (id) {
  return windows_id ..@get(id)
}*/

// TODO what about delayed_events ?
exports.tabs.open = function (options) {
  if (options == null) {
    options = {}
  }

  // This is unnecessary since Chrome defaults to the new tab page,
  // but I prefer being explicit about it
  if (options.url == null) {
    options.url = @url.newTab
  }

  if (options.pinned == null) {
    options.pinned = false
  }

  if (options.focused == null) {
    options.focused = true
  }

  var info = @async.tabs.create({
    url:    options.url,
    pinned: options.pinned,
    active: options.focused
  })

  // TODO handle retraction
  waitfor (var tab) {
    // TODO this doesn't seem quite right...
    delay({
      type: "tabs.create",
      window_id: info.windowId,
      tab_id: info.id,
      action: function () {
        var tab = @active.tabs.get(info.id)

        @assert.is(tab.url, options.url)
        @assert.is(tab.pinned, options.pinned)
        @assert.is(tab.focused, options.focused)
        tab_check(tab, info) // TODO remove this or something ?

        resume(tab)
      }
    })
  }

  return tab
}

// TODO what happens with delayed_events ?
/*exports.windows.open = function (info) {
  return windows_id ..@get(openWindow(info).id)
}*/

exports.windows.move = function (window, info) {
  @async.windows.move(window.__id__, info)
}

exports.windows.maximize = function (window) {
  @async.windows.maximize(window.__id__)
}

exports.windows.unmaximize = function (window) {
  @async.windows.unmaximize(window.__id__)
}

exports.windows.close = function (window) {
  @async.windows.remove(window.__id__)
}

/*function availSupported() {
  return !(screen.availLeft === 0 &&
           screen.availTop === 0 &&
           screen.availWidth === screen.width &&
           screen.availHeight === screen.height)
}*/

// TODO do I need the ability to force it?
exports.windows.getMaximumSize = function (force) {
  // TODO assert that force is a boolean
  /*if (!force && availSupported()) {
    return {
      left: screen.availLeft,
      top: screen.availTop,
      width: screen.availWidth,
      height: screen.availHeight
    }

  // In older versions of Chrome (on Linux only?) screen.avail wouldn't work,
  // so we fall back to the old approach of "create a maximized window then check its size"
  } else {*/
    // A bit hacky
    var window = openInternalWindow({ url: url_empty, focused: false })

    // Super hacky, but needed because of Chrome's retardedness
    @async.windows.maximize(window.id)
    hold(250)

    // Yes we really need to do this twice
    // Yes we really need the 250ms delay
    // That's how stupid Chrome is
    @async.windows.maximize(window.id)
    hold(250)

    var info = @async.windows.get(window.id)
    @async.windows.remove(window.id)

    // TODO creating a maximized window and checking its size causes it to be off by 1, is this true only on Linux?
    return {
      left: info.left,
      top: info.top,
      width: info.width,
      height: info.height
    }
  //}
}


/*chrome.tabs.onCreated.addListener(function (tab) {
  console.debug("tabs.onCreated")
})

chrome.tabs.onUpdated.addListener(function (id, info, tab) {
  console.debug("tabs.onUpdated", tab)
})

chrome.tabs.onRemoved.addListener(function (id, info) {
  console.debug("tabs.onRemoved")
})

chrome.tabs.onReplaced.addListener(function (added, removed) {
  console.debug("tabs.onReplaced")
})

chrome.tabs.onActivated.addListener(function (info) {
  console.debug("tabs.onActivated", info)
})

chrome.tabs.onMoved.addListener(function (id, info) {
  console.debug("tabs.onMoved")
})

chrome.tabs.onDetached.addListener(function (id, info) {
  console.debug("tabs.onDetached")
})

chrome.tabs.onAttached.addListener(function (id, info) {
  console.debug("tabs.onAttached")
})

chrome.windows.onCreated.addListener(function (window) {
  console.debug("windows.onCreated")
})

chrome.windows.onRemoved.addListener(function (id) {
  console.debug("windows.onRemoved")
})

setTimeout(function () {
  chrome.tabs.create({}, function (tab) {
    console.debug("tabs.create", tab)

    //chrome.windows.create({ tabId: tab.id }, function () {
      setTimeout(function () {
        chrome.tabs.move(tab.id, { index: 0 }, function (tab) {
          console.debug("tabs.move", tab)
        })
        chrome.windows.getAll({ populate: true }, function (wins) {
          chrome.tabs.update(wins[0].tabs[0].id, { active: true }, function (tab) {
            console.debug("tabs.update", tab)
          })
        })
        chrome.tabs.update(tab.id, { url: "http://google.com" }, function (tab) {
          console.debug("tabs.update", tab)
        })
        chrome.tabs.remove(tab.id, function () {
          console.debug("tabs.remove")
        })
      }, 5000)
    //})
  })
}, 5000)*/


/**
 * @ Tab lifecycle
 *
 *   @ When creating
 *     @ If it's a new window
 *       windows.onCreated
 *     tabs.onCreated
 *     tabs.onActivated
 *     tabs.create
 *     @ If it's not loaded from cache
 *       tabs.onUpdated
 *
 *   @ When updating
 *     tabs.update
 *     tabs.onUpdated
 *
 *   @ When focusing a different tab
 *     tabs.onActivated
 *     tabs.update
 *
 *   @ When moving in the same window
 *     tabs.onMoved
 *     tabs.move
 *
 *   @ When moving to another window
 *     @ If the old window still has tabs in it
 *       windows.onCreated
 *       tabs.onDetached
 *       tabs.onActivated (old window)
 *       tabs.onAttached
 *       tabs.onActivated (new window)
 *
 *       tabs.onDetached
 *       tabs.onAttached
 *       tabs.onActivated (new window)
 *       windows.onRemoved
 *
 *     @ If the old window does not still have tabs in it
 *       tabs.onDetached
 *       tabs.onAttached
 *       tabs.onActivated (new window)
 *       windows.onRemoved
 *
 *   @ When removing
 *     tabs.onRemoved
 *     @ If the old window still has tabs in it
 *       tabs.onActivated
 *       tabs.remove
 *     @ If the old window does not still have tabs in it
 *       tabs.remove
 *       windows.onRemoved
 */
var windows = @getAllWindows()
@saved.init(windows)
@active.init(windows)

chrome.windows.onCreated.addListener(function (window) {
  @checkError()

  var id = @timestamp()

  @saved.windows.open(id, window)

  delay({
    type: "windows.onCreated",
    window_id: window.id,
    tab_id: null,
    action: function () {
      @active.windows.open(id, window)
    }
  })
})

chrome.windows.onRemoved.addListener(function (id) {
  @checkError()

  @saved.windows.close(id)

  delay({
    type: "windows.onRemoved",
    window_id: id,
    tab_id: null,
    action: function () {
      @active.windows.close(id)
    }
  })
})

chrome.tabs.onCreated.addListener(function (info) {
  @checkError()

  var id = @timestamp()

  @saved.tabs.open(id, info)

  delay({
    type: "tabs.onCreated",
    window_id: info.windowId,
    tab_id: info.id,
    action: function () {
      @active.tabs.open(id, info)
    }
  })
})

chrome.tabs.onUpdated.addListener(function (id, _, info) {
  @checkError()

  @assert.is(info.id, id)

  @saved.tabs.update(info)

  delay({
    type: "tabs.onUpdated",
    window_id: info.windowId,
    tab_id: info.id,
    action: function () {
      @active.tabs.update(info)
    }
  })
})

chrome.tabs.onRemoved.addListener(function (id, info) {
  @checkError()

  @saved.tabs.close(id, info)

  delay({
    type: "tabs.onRemoved",
    window_id: info.windowId,
    tab_id: id,
    action: function () {
      @active.tabs.close(id, info)
    }
  })
})

// This event is fired when Chrome swaps in one renderer process for another
// I believe this happens when Chrome prerenders a page in the background (for faster loading)
chrome.tabs.onReplaced.addListener(function (added, removed) {
  @checkError()

  // Chrome only gives us the ID, not the actual tab, so we have to use this to get the tab
  // TODO should this use waitfor or something? what if something happens while this is being processed?
  chrome.tabs.get(added, function (info) {
    @checkError()

    @assert.is(info.id, added)

    @saved.tabs.replace(removed, info)

    delay({
      type: "tabs.onReplaced",
      window_id: info.windowId,
      tab_id: removed, // TODO what about the new id ?
      action: function () {
        @active.tabs.replace(removed, info)
      }
    })
  })
})

chrome.tabs.onActivated.addListener(function (info) {
  @checkError()

  @saved.tabs.focus(info.tabId, info.windowId)

  delay({
    type: "tabs.onActivated",
    window_id: info.windowId,
    tab_id: info.tabId,
    action: function () {
      @active.tabs.focus(info.tabId, info.windowId)
    }
  })
})

chrome.tabs.onMoved.addListener(function (id, info) {
  @checkError()

  @saved.tabs.move(id, info.windowId, info.fromIndex, info.toIndex)

  delay({
    type: "tabs.onMoved",
    window_id: info.windowId,
    tab_id: id,
    action: function () {
      @active.tabs.move(id, info.windowId, info.fromIndex, info.toIndex)
    }
  })
})

chrome.tabs.onDetached.addListener(function (id, info) {
  @checkError()

  @saved.tabs.detach(id, info.oldWindowId, info.oldPosition)

  delay({
    type: "tabs.onDetached",
    window_id: info.oldWindowId,
    tab_id: id,
    action: function () {
      @active.tabs.detach(id, info.oldWindowId, info.oldPosition)
    }
  })
})

chrome.tabs.onAttached.addListener(function (id, info) {
  @checkError()

  @saved.tabs.attach(id, info.newWindowId, info.newPosition)

  delay({
    type: "tabs.onAttached",
    window_id: info.newWindowId,
    tab_id: id,
    action: function () {
      @active.tabs.attach(id, info.newWindowId, info.newPosition)
    }
  })
})
