@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" },
  { id: "lib:util/util" },
  { id: "lib:util/event" },
  { id: "../util" },
  { id: "./url", name: "url" },
  { id: "./tabs/saved", name: "saved" },
  { id: "./tabs/async", name: "chrome" },
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
    var window = @chrome.windows.create(info)
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

  var info = @chrome.tabs.create({
    url:    options.url,
    pinned: options.pinned,
    active: options.focused
  })

  // TODO what if an error is thrown inside this waitfor ?
  // TODO handle retraction
  waitfor (var tab) {
    // TODO this doesn't seem quite right...
    delay({
      type: "tabs.create",
      window_id: info.windowId,
      tab_id: info.id,
      action: function () {
        var tab = @active.tabs.get(info.id)
        resume(tab)
      }
    })
  }

  return tab
}

exports.tabs.focus = function (tab) {
  @chrome.tabs.update(tab.__id__, { active: true })
}

exports.tabs.close = function (tab) {
  @chrome.tabs.remove(tab.__id__)
}

// TODO what happens with delayed_events ?
/*exports.windows.open = function (info) {
  return windows_id ..@get(openWindow(info).id)
}*/

exports.windows.move = function (window, info) {
  @chrome.windows.move(window.__id__, info)
}

exports.windows.maximize = function (window) {
  @chrome.windows.maximize(window.__id__)
}

exports.windows.unmaximize = function (window) {
  @chrome.windows.unmaximize(window.__id__)
}

exports.windows.close = function (window) {
  @chrome.windows.remove(window.__id__)
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

    @chrome.windows.maximize(window.id)

    // TODO Yes we really need this delay, because Chrome is stupid
    hold(500)

    var info = @chrome.windows.get(window.id)
    @chrome.windows.remove(window.id)

    // TODO creating a maximized window and checking its size causes it to be off by 1, is this true only on Linux?
    return {
      left: info.left,
      top: info.top,
      width: info.width,
      height: info.height
    }
  //}
}

/*chrome.tabs.onRemoved.addListener(function (id, info) {
  console.debug("tabs.onRemoved")
})

chrome.tabs.create({}, function (tab) {
  chrome.tabs.remove(tab.id, function () {
    console.debug("tabs.remove")
  })
})*/


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
  console.debug("windows.onRemoved", id)
})

chrome.windows.create({}, function (window) {
  chrome.windows.remove(window.id, function () {
    console.debug("windows.remove", window.id)
  })
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
 *   @ When removing a window
 *     windows.remove
 *     windows.onRemoved
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
var windows = @chrome.windows.getAll({ populate: true })
@saved.init(windows)
@active.init(windows)

@chrome.windows.onCreated ..@listen(function (window) {
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

@chrome.windows.onRemoved ..@listen(function (id) {
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

@chrome.tabs.onCreated ..@listen(function (info) {
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

@chrome.tabs.onUpdated ..@listen(function (info) {
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

@chrome.tabs.onRemoved ..@listen(function (info) {
  @saved.tabs.close(info.id, info)

  delay({
    type: "tabs.onRemoved",
    window_id: info.windowId,
    tab_id: info.id,
    action: function () {
      @active.tabs.close(info.id, info)
    }
  })
})

// This event is fired when Chrome swaps in one renderer process for another
// I believe this happens when Chrome prerenders a page in the background (for faster loading)
@chrome.tabs.onReplaced ..@listen(function (info) {
  // Chrome only gives us the ID, not the actual tab, so we have to use this to get the tab
  // TODO should this use waitfor or something? what if something happens while this is being processed?
  var tab = @chrome.tabs.get(info.added)
  @assert.is(tab.id, info.added)

  @saved.tabs.replace(info.removed, tab)

  delay({
    type: "tabs.onReplaced",
    window_id: tab.windowId,
    tab_id: info.removed, // TODO what about the new id ?
    action: function () {
      @active.tabs.replace(info.removed, tab)
    }
  })
})

@chrome.tabs.onActivated ..@listen(function (info) {
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

@chrome.tabs.onMoved ..@listen(function (info) {
  @saved.tabs.move(info.id, info.windowId, info.fromIndex, info.toIndex)

  delay({
    type: "tabs.onMoved",
    window_id: info.windowId,
    tab_id: info.id,
    action: function () {
      @active.tabs.move(info.id, info.windowId, info.fromIndex, info.toIndex)
    }
  })
})

@chrome.tabs.onDetached ..@listen(function (info) {
  @saved.tabs.detach(info.id, info.oldWindowId, info.oldPosition)

  delay({
    type: "tabs.onDetached",
    window_id: info.oldWindowId,
    tab_id: info.id,
    action: function () {
      @active.tabs.detach(info.id, info.oldWindowId, info.oldPosition)
    }
  })
})

@chrome.tabs.onAttached ..@listen(function (info) {
  @saved.tabs.attach(info.id, info.newWindowId, info.newPosition)

  delay({
    type: "tabs.onAttached",
    window_id: info.newWindowId,
    tab_id: info.id,
    action: function () {
      @active.tabs.attach(info.id, info.newWindowId, info.newPosition)
    }
  })
})
