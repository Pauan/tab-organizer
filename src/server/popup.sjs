// TODO lots of Chromeisms in here

@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" },
  { id: "lib:util/event" },
  { id: "lib:util/observe" },
  { id: "lib:extension/server" },
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
var avail = {
  left:    @cache.get("screen.available.left"),
  top:     @cache.get("screen.available.top"),
  width:   @cache.get("screen.available.width"),
  height:  @cache.get("screen.available.height"),
  checked: @cache.get("screen.available.checked")
}

function get_monitor_size() {
  // TODO force or not (see extension/chrome/windows.getMaximumSize)?
  var size = @windows.getMaximumSize(false)
  avail.left.set(size.left)
  avail.top.set(size.top)
  avail.width.set(size.width)
  avail.height.set(size.height)
  avail.checked.set(true)
  return size
}

function get_size() {
  if (avail.checked.get()) {
    return {
      left:   avail.left.get(),
      top:    avail.top.get(),
      width:  avail.width.get(),
      height: avail.height.get()
    }
  } else {
    return get_monitor_size()
  }
}

@connection.on.command("get-monitor-size", function () {
  get_monitor_size()
  return null
})


var type = @opt.get("popup.type")

var popup_url = "panel.html"

var state = {
  tab:   null,
  panel: null,
  popup: null,
  type:  null,
  size:  null
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

    @popup.close(state.popup)

  } else if (state.tab !== null) {
    check_tab()
    @tabs.close(state.tab)

  } else if (state.panel !== null) {
    check_panel()
    @popup.close(state.panel)
  }

  check_empty()
}

function open_popup(size) {
  if (state.popup === null) {
    var o    = {}
    o.url    = popup_url
    o.left   = size.left
    o.top    = size.top
    o.width  = size.width
    o.height = size.height
    state.popup = @popup.open(o)
  } else {
    waitfor {
      @popup.focus(state.popup)
    } and {
      @popup.move(state.popup, size)
    }
  }
}

function open_panel() {
  if (state.panel === null) {
    state.panel = @popup.openPanel({ url: popup_url })
  } else {
    @popup.focus(state.panel)
  }
}

function open_tab() {
  if (state.tab === null) {
    state.tab = @tabs.open({ url: popup_url })
  } else {
    @tabs.focus(state.tab)
  }
}

function to_all(f) {
  // TODO use each.par ?
  @windows.getCurrent() ..@each(function (x) {
    f(x)
  })
}

function resize_window(w) {
  @windows.move(w, state.size.window)
}

function unresize_window(w) {
  @windows.maximize(w)
}

function unresize_sidebar() {
  to_all(unresize_window)
  state.size = null
}

function get_dimensions(pos) {
  var width = @opt.get("size.sidebar").get()
    , dir   = @opt.get("size.sidebar.position").get()

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

function open() {
  var type_new = type.get()
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

  state.type = type_new

  if (type_new === "popup") {
    var size   = get_size()
      , left   = @opt.get("size.popup.left").get()
      , top    = @opt.get("size.popup.top").get()
      , width  = @opt.get("size.popup.width").get()
      , height = @opt.get("size.popup.height").get()

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
    open_panel()
    check_panel()

  } else {
    @assert.fail()
  }
}

@observe([type], function (type) {
  if (type === "bubble") {
    @button.setURL(popup_url)
  } else {
    // TODO I don't like that setting the URL to "" disables it
    @button.setURL("")
  }
})

@button.on.clicked ..@listen(function () {
  open()
})

@windows.on.open ..@listen(function (info) {
  var window = info.window
  if (state.type === "sidebar") {
    check_sidebar()
    resize_window(window)
  }
})

@popup.on.closed ..@listen(function (info) {
  var popup = info.popup

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

  } else if (state.panel !== null && state.panel.id === popup.id) {
    check_panel()

    state.panel = null
    state.type = null
    check_empty()
  }
})

@tabs.on.close ..@listen(function (info) {
  var tab = info.tab
  console.log("tab.remove", state.tab, tab)
  if (state.tab !== null && state.tab.id === tab.id) {
    check_tab()

    state.tab = null
    state.type = null
    check_empty()
  }
})

console.info("popup: finished")
