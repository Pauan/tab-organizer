// TODO lots of Chromeisms in here

@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" },
  { id: "lib:extension/server" },
  { id: "lib:util/event" },
  { id: "./options" }
])

/*
 !         -> tab     (opens $2)
 !         -> panel   (opens $2)
 !         -> popup   (gets size, opens $2)
 !         -> sidebar (gets size, opens $2, resizes windows)
 !         -> bubble  (opens $2)

 ! tab     -> tab     (focuses tab + window)
 ! panel   -> panel   (focuses $1)
 ! popup   -> popup   (focuses $1)
 ! sidebar -> sidebar (focuses $1, resizes windows)
 ! bubble  -> bubble  (not possible, probably closes bubble)

 ! tab     ->         (nothing)
 ! panel   ->         (nothing)
 ! popup   ->         (nothing)
 ! sidebar ->         (unresizes windows)
 ! bubble  ->         (nothing)

 ! tab     -> panel   (closes $1, opens $2)
 ! tab     -> popup   (closes $1, opens $2)
 ! tab     -> sidebar (closes $1, opens $2, resizes windows)
 ! tab     -> bubble  (closes $1, opens $2)

 ! panel   -> tab     (closes $1, opens $1)
 ! panel   -> popup   (closes $1, opens $1)
 ! panel   -> sidebar (closes $1, opens $1, resizes windows)
 ! panel   -> bubble  (closes $1, opens $1)

 ! popup   -> tab     (closes $1, opens $2)
 ! popup   -> panel   (closes $1, opens $2)
 ! popup   -> sidebar (moves $1, resizes windows)
 ! popup   -> bubble  (closes $1, opens $2)

 ! sidebar -> tab     (closes $1, unresizes windows, opens $2)
 ! sidebar -> panel   (closes $1, unresizes windows, opens $2)
 ! sidebar -> popup   (moves $1, unresizes windows)
 ! sidebar -> bubble  (closes $1, unresizes windows, opens $2)

 ! bubble  -> tab     (closes $1?, opens $2)
 ! bubble  -> panel   (closes $1?, opens $2)
 ! bubble  -> popup   (closes $1?, opens $2)
 ! bubble  -> sidebar (closes $1?, opens $2, resizes windows)


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

var url_empty = @url.get("data/empty.html")

/*function availSupported() {
  return !(screen.availLeft === 0 &&
           screen.availTop === 0 &&
           screen.availWidth === screen.width &&
           screen.availHeight === screen.height)
}*/

/*function redirectEvents(f) {
  var events = []

  var emitter = @Emitter()

  waitfor {
    emitter ..@each(function (x) { events.push(x) })
  } and {
    var old = @tabs.events
    @tabs.events = emitter

    try {
      var x = f()
    } finally {
      @tabs.events = old
    }

    collapse
    return [events, x]
  }
}*/

// TODO do I need the ability to force it?
function getMaximumSize(force) {
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

    var popup = @popup.open({ url: url_empty, focused: false })

    /*var seen = false

    events ..@each(function (x) {
      if ((x.before && x.before.window && x.before.window.id === window.id) ||
          (x.after  && x.after.window  && x.after.window.id  === window.id)) {
        if (x.type === "windows.open") {
          @assert.is(seen, false)
          seen = true
        }
      } else {
        @tabs.events ..@emit(x)
      }
    })

    @assert.is(seen, true)*/

    @popup.maximize(popup.id)

    // TODO Yes we really need this delay, because Chrome is stupid
    hold(500)

    var info = @popup.getDimensions(popup.id)

    @popup.close(popup.id)

    // TODO creating a maximized window and checking its size causes it to be off by 1, is this true only on Linux?
    return {
      left: info.left,
      top: info.top,
      width: info.width,
      height: info.height
    }
  //}
}

function get_monitor_size() {
  // TODO force or not ?
  var size = getMaximumSize(false);

  @cache.set("screen.available.left",    size.left);
  @cache.set("screen.available.top",     size.top);
  @cache.set("screen.available.width",   size.width);
  @cache.set("screen.available.height",  size.height);
  @cache.set("screen.available.checked", true);

  return size;
}

function get_size() {
  if (@cache.get("screen.available.checked")) {
    return {
      left:   @cache.get("screen.available.left"),
      top:    @cache.get("screen.available.top"),
      width:  @cache.get("screen.available.width"),
      height: @cache.get("screen.available.height")
    }
  } else {
    return get_monitor_size()
  }
}

@connection.on.command("get-monitor-size", function () {
  get_monitor_size()
  return null
})


var popup_url = "popup.html"

var state = {
  tab:   null,
  panel: null,
  popup: null,
  type:  null,
  size:  null,
  pause: null,
}

function pause() {
  @assert.is(state.pause, null)
  waitfor {
    waitfor () {
      state.pause = resume
    } finally {
      state.pause = null
    }
  } or {
    hold(5000)
    throw new Error("pause took too long")
  }
}

function unpause() {
  if (state.pause) {
    state.pause()
  }
}

function check_sidebar() {
  @assert.is(state.type, "sidebar")
  @assert.is(state.tab, null)
  @assert.is(state.panel, null)
  @assert.isNot(state.popup, null)
  @assert.isNot(state.size, null)
}

function check_popup() {
  @assert.is(state.type, "popup")
  @assert.is(state.tab, null)
  @assert.is(state.panel, null)
  @assert.isNot(state.popup, null)
  @assert.is(state.size, null)
}

function check_tab() {
  @assert.is(state.type, "tab")
  @assert.isNot(state.tab, null)
  @assert.is(state.panel, null)
  @assert.is(state.popup, null)
  @assert.is(state.size, null)
}

function check_panel() {
  @assert.is(state.type, "panel")
  @assert.is(state.tab, null)
  @assert.isNot(state.panel, null)
  @assert.is(state.popup, null)
  @assert.is(state.size, null)
}

function check_empty() {
  @assert.is(state.type, null)
  @assert.is(state.tab, null)
  @assert.is(state.panel, null)
  @assert.is(state.popup, null)
  @assert.is(state.size, null)
}

function remove_all() {
  if (state.popup !== null) {
    if (state.type === "sidebar") {
      check_sidebar()
    } else if (state.type === "popup") {
      check_popup()
    } else {
      @assert.fail()
    }

    waitfor {
      pause()
    } and {
      @popup.close(state.popup.id)
    }

  } else if (state.tab !== null) {
    check_tab()

    waitfor {
      pause()
    } and {
      @tabs.close(state.tab.id)
    }

  } else if (state.panel !== null) {
    check_panel()

    waitfor {
      pause()
    } and {
      @popup.close(state.panel.id)
    }
  }

  check_empty()
}

function open_popup(size) {
  if (state.popup === null) {
    var o    = {}
    o.type   = "popup"
    o.url    = popup_url
    o.left   = size.left
    o.top    = size.top
    o.width  = size.width
    o.height = size.height
    state.popup = @popup.open(o)
  }

  // TODO move into else clause
  waitfor {
    @popup.focus(state.popup.id)
  } and {
    @popup.move(state.popup.id, size)
  }
}

function open_panel(size) {
  if (state.panel === null) {
    var o    = {}
    o.type   = "panel"
    o.url    = popup_url
    o.width  = size.width
    o.height = size.height
    state.panel = @popup.open(o)
  } else {
    waitfor {
      @popup.focus(state.panel.id)
    } and {
      @popup.move(state.panel.id, size)
    }
  }
}

function open_tab() {
  if (state.tab === null) {
    state.tab = @tabs.open({ url: popup_url })
  } else {
    @tabs.focus(state.tab.id)
  }
}

function to_all(f) {
  @windows.getCurrent() ..@each.par(function (x) {
    f(x)
  })
}

function resize_window(w) {
  @windows.move(w.id, state.size.window)
}

function unresize_window(w) {
  @windows.maximize(w.id)
}

function unresize_sidebar() {
  to_all(unresize_window)
  state.size = null
}

function get_dimensions(pos) {
  var width = @opt.get("size.sidebar")
    , dir   = @opt.get("size.sidebar.position")

  // TODO assert that dir is left, right, top, or bottom
  return {
    sidebar: {
      left:   (dir === "right"
                ? pos.left + pos.width - width
                : pos.left),
      top:    (dir === "bottom"
                ? pos.top + pos.height - width
                : pos.top),
      width:  (dir === "left" || dir === "right"
                ? width
                : pos.width),
      height: (dir === "top" || dir === "bottom"
                ? width
                : pos.height)
    },

    window: {
      left:   (dir === "left"
                ? pos.left + width
                : pos.left),
      top:    (dir === "top"
                ? pos.top + width
                : pos.top),
      width:  (dir === "left" || dir === "right"
                ? pos.width - width
                : pos.width),
      height: (dir === "top" || dir === "bottom"
                ? pos.height - width
                : pos.height)
    }
  }
}

function cleanup(type_new) {
  var type_old = state.type

  if (type_old !== null && type_old !== type_new) {
    if (type_old === "sidebar" && type_new === "popup") {
      check_sidebar()
      unresize_sidebar()
    } else if (type_old === "popup" && type_new === "sidebar") {
      check_popup()
    } else {
      remove_all()
    }
  }
}

function open() {
  var type_new = @opt.get("popup.type");

  cleanup(type_new)

  state.type = type_new

  if (type_new === "popup") {
    var size   = get_size()
      , left   = @opt.get("size.popup.left")
      , top    = @opt.get("size.popup.top")
      , width  = @opt.get("size.popup.width")
      , height = @opt.get("size.popup.height")

    open_popup({
      left:   size.left + (size.width  * left) - (width  * left),
      top:    size.top  + (size.height * top)  - (height * top),
      width:  width,
      height: height
    })

    check_popup()

    //@assert.isNot(state.popup, null)
    //@popup.focus(state.popup) // TODO is this a good idea ?

  } else if (type_new === "sidebar") {
    state.size = get_dimensions(get_size())

    // TODO this has to be before open_popup because of a bug in Chrome
    //      where moving a window causes it to be focused. In addition,
    //      we can't do it in parallel with open_popup, for that same reason
    to_all(resize_window)
    open_popup(state.size.sidebar)

    check_sidebar()

    //@assert.isNot(state.popup, null)
    //@popup.focus(state.popup) // TODO is this a good idea ?

  } else if (type_new === "tab") {
    open_tab()
    check_tab()

  } else if (type_new === "panel") {
    open_panel({
      width:  @opt.get("size.panel.width"),
      height: @opt.get("size.panel.height")
    })

    check_panel()

  } else {
    @assert.fail()
  }
}

function withType(type) {
  if (type === "bubble") {
    @button.setURL(popup_url)
  } else {
    // TODO I don't like that setting the URL to "" disables it
    @button.setURL("")
  }
}
spawn withType ..@observe(@opt.ref("popup.type"))

// TODO it's probably okay for this to drop events, so maybe it shouldn't use @listen ?
spawn @button.events ..@listen(function (info) {
  if (info.type === "click") {
    open()
  }
})

@connection.on.command("popup-opened", function () {
  var type_new = @opt.get("popup.type")
  if (type_new === "bubble") {
    cleanup(type_new)
    check_empty()
  }
  return null
})

spawn @popup.events ..@listen(function (info) {
  if (info.type === "popup.close") {
    var popup = info.before.popup

    if (state.popup !== null && state.popup.id === popup.id) {
      if (state.type === "sidebar") {
        check_sidebar()
        unresize_sidebar()
      } else if (state.type === "popup") {
        check_popup()
      } else {
        @assert.fail()
      }

      state.popup = null
      state.type = null
      check_empty()
      unpause()

    } else if (state.panel !== null && state.panel.id === popup.id) {
      check_panel()

      state.panel = null
      state.type = null
      check_empty()
      unpause()
    }
  }
})

spawn @tabs.events ..@spawn(function (info) {
  if (info.type === "windows.open") {
    var window = info.after.window

    if (state.type === "sidebar") {
      check_sidebar()
      resize_window(window)
    }

  } else if (info.type === "tabs.close") {
    var tab = info.before.tab

    if (state.tab !== null && state.tab.id === tab.id) {
      check_tab()

      state.tab = null
      state.type = null
      check_empty()
      unpause()
    }
  }
})

console.info("popup: finished")
