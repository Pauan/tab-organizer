/**
 * Functions for dealing with Chrome's asynchronousness
 */

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
 *       windows.onFocusChanged (old)
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
 *
 *
 * windows.onCreated
 */
@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:object" },
  { id: "sjs:sequence" },
  { id: "lib:util/queue" },
  { id: "lib:util/util" },
  { id: "../chrome/util" },
  { id: "../chrome/windows", name: "windows" },
  { id: "../chrome/tabs", name: "tabs" },
  { id: "./url", name: "url" }
])
/*
var o = {}

  o.type = "normal"
  o.url = info.url

  // TODO util for this
  if (info.focused == null) {
    o.focused = true
  } else {
    o.focused = info.focused
  }
  */


function setCoordinates(o, info) {
  // TODO test these
  if (info.left != null) {
    o.left = info.left
  }
  if (info.top != null) {
    o.top = info.top
  }
  if (info.width != null) {
    o.width = info.width
  }
  if (info.height != null) {
    o.height = info.height
  }
}

// TODO if using left/top/width/height, the window will have very slightly incorrect dimensions
//      this can be fixed by calling exports.windows.move afterwards, but it'd be nice if
//      exports.windows.open would Just Work(tm)
function windows_create(info) {
  var o = {}

  setCoordinates(o, info)

  if (info.url != null) {
    o.url = info.url

  // This is unnecessary since Chrome defaults to the new tab page,
  // but I prefer being explicit about it
  } else {
    o.url = @url.newTab
  }

  if (info.focused != null) {
    o.focused = info.focused
  } else {
    o.focused = true
  }

  // TODO
  if (info["private"] != null) {
    o.incognito = info["private"]
  }

  o.type = info ..@get("type")

  return @windows.create(o);
}

function windows_isNormal(window) {
  return window.type === "normal"
}

function windows_isPopup(window) {
  return window.type === "popup" || window.type === "panel"
}

function update_indexes(array, index) {
  for (var l = array.length; index < l; ++index) {
    var x = array[index];
    if (x.index !== index) {
      x.index = index;
    }
  }
}

function remove_at(array, x) {
  @assert.is(array[x.index], x);
  array.splice(x.index, 1);
  update_indexes(array, x.index);
}

function insert_at(array, x) {
  array.splice(x.index, 0, x);
  update_indexes(array, x.index + 1);
}

function move_from_to(array, x, to) {
  var from = x.index;
  @assert.is(array[from], x);
  array.splice(from, 1);
  x.index = to;
  array.splice(to, 0, x);
  update_indexes(array, Math.min(from, to + 1));
}


exports.popup           = {};
exports.popup.on        = {};
exports.popup.on.open   = "__D94EDCF1-E31F-4D79-9085-6E40F3BE1A02_popup.open__";
//exports.popup.on.focus  = "__BAE332FC-31E7-469B-89CF-C0BB6D95E44E_popup.focus__";
exports.popup.on.close  = "__57E64DAB-2BB2-4EAB-A429-2D3B8AB0C366_popup.close__";

exports.tab             = {};
exports.tab.on          = {};
exports.tab.on.open     = "__26450EAF-3756-4F23-BCC5-E0CDAD988906_tab.open__";
exports.tab.on.update   = "__CB1A1FA5-01F9-4608-9E2D-3E55834BBC08_tab.update__";
exports.tab.on.replace  = "__78385878-1E85-4FAC-927E-9139D50FC44F_tab.replace__";
exports.tab.on.focus    = "__4468144A-B721-41B0-B595-5D82FCC64303_tab.focus__";
exports.tab.on.move     = "__605B373C-C01B-4C36-B440-498CFB4F621B_tab.move__";
exports.tab.on.close    = "__69438EE1-9CB7-4289-8F48-126888EC0BB0_tab.close__";

exports.window          = {};
exports.window.on       = {};
exports.window.on.open  = "__F527F64D-28FB-470F-B35E-F61F27E49169_window.open__";
//exports.window.on.focus = "__7F683B82-9E41-4AD6-8977-A689CA1A5C82_window.focus__";
exports.window.on.close = "__3AA3F892-76B8-4130-BA72-641880273DC4_window.close__";


var popups_publisher  = @Publisher();
var windows_publisher = @Publisher();

var popups        = [];
var popups_by_id  = {};

var windows       = [];
var windows_by_id = {};
var tabs_by_id    = {};

//var focusedPopup      = null;
//var focusedWindow     = null;


function create_popup(info) {
  var popup = {
    id: info.id,
    type: info.type,
    // TODO
    "private": info.incognito,
    //focused: false
  };

  popup.index = popups.push(popup) - 1,

  popups_by_id ..@setNew(info.id, popup);

  /*if (info.focused) {
    focus_popup(popup);
  }*/

  return popup;
}

function remove_popup(popup) {
  popups_by_id ..@delete(popup.id);
  remove_at(popups, popup);
}


function to_favicon(info) {
  if (info.favIconUrl && /^data:/.test(info.favIconUrl)) {
    return info.favIconUrl;
  } else if (info.url) {
    return "chrome://favicon/#{info.url}";
  } else {
    return null;
  }
}

function create_tab(info) {
  var window = windows_by_id ..@get(info.windowId);

  var tab = {
    id: info.id,
    index: info.index,
    window: window
  };

  update_tab(tab, info);

  tabs_by_id ..@setNew(info.id, tab);
  insert_at(window.tabs, tab);

  if (info.active) {
    focus_tab(window, tab);
  }

  return tab;
}

function should_update_tab(tab, info) {
  @assert.is(tab.id, info.id);
  @assert.is(tab.index, info.index);
  @assert.is(tab.window.id, info.windowId);
  //@assert.is(tab.focused, info.active);

  return tab.url     !== info.url    ||
         tab.title   !== info.title  ||
         tab.pinned  !== info.pinned ||
         tab.favicon !== to_favicon(info);
}

function update_tab(tab, info) {
  tab.url     = info.url;
  tab.title   = info.title;
  tab.pinned  = info.pinned;
  tab.favicon = to_favicon(info);
}

function emit_update_tab(info) {
  var tab = tabs_by_id ..@get(info.id);

  if (should_update_tab(tab, info)) {
    update_tab(tab, info);

    windows_publisher.publish({
      type: exports.tab.on.update,
      tab: tab
    });
  }
}

function remove_tab(tab) {
  defocus_tab(tab);
  tabs_by_id ..@delete(tab.id);
  remove_at(tab.window.tabs, tab);
}


function create_window(info) {
  var window = {
    id: info.id,
    // TODO
    "private": info.incognito,
    //focused: false,
    focusedTab: null,
    tabs: []
  };

  window.index = windows.push(window) - 1;
  windows_by_id ..@setNew(info.id, window);

  if (info.tabs) {
    info.tabs ..@each(function (info) {
      create_tab(info);
    });
  }

  /*if (info.focused) {
    focus_window(window);
  }*/

  return window;
}

function remove_window(window) {
  windows_by_id ..@delete(window.id);
  @assert.is(window.tabs.length, 0);
  remove_at(windows, window);
}


/*function unfocus_popup() {
  var old = focusedPopup;

  if (old !== null) {
    @assert.is(old.focused, true);
    old.focused = false;

    focusedPopup = null;
  }

  return old;
}

function unfocus_window() {
  var old = focusedWindow;

  if (old !== null) {
    @assert.is(old.focused, true);
    old.focused = false;

    focusedWindow = null;
  }

  return old;
}*/

/*function unfocus_tab(window) {
  var old = window.focusedTab;
  window.focusedTab = null;
  return old;
}*/

function defocus_tab(tab) {
  if (tab.window.focusedTab === tab) {
    tab.window.focusedTab = null;
  }
}

/*function focus_popup(popup) {
  @assert.is(popup.focused, false);
  @assert.is(focusedPopup, null);

  popup.focused = true;
  focusedPopup = popup;
}

function focus_window(window) {
  @assert.is(window.focused, false);
  @assert.is(focusedWindow, null);

  window.focused = true;
  focusedWindow = window;
}*/

function focus_tab(window, tab) {
  @assert.isNot(window.focusedTab, tab);
  window.focusedTab = tab;
}


/*exports.popup.step = function (state, event) {
  var type = event.type;
  if (type === exports.popup.on.open) {
    return state.modify("popups", function (popups) {
      return popups.push(event.popup.value, event.popup.index);
    });

  } else if (type === exports.popup.on.close) {
    return state.modify("popups", function (popups) {
      return popups.pop(event.popup.index);
    });

  } else if (type === exports.popup.on.focus) {
    return state.set("focusedPopup", event.popup.index);

  } else if (type === exports.popup.on.unfocus) {
    return state.set("focusedPopup", null);

  } else {
    return state;
  }
};


function modify_window(state, index, f) {
  return state.modify("windows", function (windows) {
    return windows.modify(index, function (window) {
      return f(window);
    });
  });
}

function modify_tabs(state, index, f) {
  return modify_window(state, index, function (window) {
    return window.modify("tabs", function (tabs) {
      return f(tabs);
    });
  });
}


exports.window.step = function (state, event) {
  var type = event.type;
  if (type === exports.window.on.open) {
    return state.modify("windows", function (windows) {
      return windows.push(event.window.value, event.window.index);
    });

  } else if (type === exports.window.on.close) {
    return state.modify("windows", function (windows) {
      return windows.pop(event.window.index);
    });

  } else if (type === exports.window.on.focus) {
    return state.set("focusedWindow", event.window.index);

  } else if (type === exports.window.on.unfocus) {
    return state.set("focusedWindow", null);

  } else if (type === exports.tab.on.open) {
    return modify_tabs(state, event.window.index, function (tabs) {
      return tabs.push(event.tab.value, event.tab.index);
    });

  } else if (type === exports.tab.on.close) {
    return modify_tabs(state, event.window.index, function (tabs) {
      return tabs.pop(event.tab.index);
    });

  } else if (type === exports.tab.on.update) {
    return modify_tabs(state, event.window.index, function (tabs) {
      return tabs.modify(event.tab.index, function () {
        return event.tab.value;
      });
    });

  } else if (type === exports.tab.on.focus) {
    return modify_window(state, event.window.index, function (window) {
      return window.set("focusedTab", event.tab.index);
    });

  } else if (type === exports.tab.on.unfocus) {
    return modify_window(state, event.window.index, function (window) {
      return window.set("focusedTab", null);
    });

  } else if (type === exports.tab.on.move) {
    if (event.before !== null) {
      state = modify_tabs(state, event.before.window.index, function (tabs) {
        return tabs.pop(event.before.tab.index);
      });
    }

    if (event.after !== null) {
      state = modify_tabs(state, event.after.window.index, function (tabs) {
        return tabs.push(event.after.tab.value, event.after.tab.index);
      });
    }

    return state;

  } else {
    return state;
  }
};*/


exports.window.open = function (info) {
  info ..@setNew("type", "normal");
  var window = windows_create(info);
  return windows_by_id ..@get(window.id);
};

exports.popup.open = function (info) {
  if (info.type == null) {
    info.type = "popup";
  }

  @assert.ok(info.type === "popup" || info.type === "panel");
  var window = windows_create(info);
  return popups_by_id ..@get(window.id);
};

exports.window.getDimensions = exports.popup.getDimensions = function (id) {
  var state = @windows.get(id);

  return {
    left: state.left,
    top: state.top,
    width: state.width,
    height: state.height
  };
};

exports.window.minimize = exports.popup.minimize = function (id) {
  var state = @windows.get(id);

  // TODO test this
  if (state.state === "normal" || state.state === "maximized") {
    // TODO do we need to set its state to normal first, like with exports.windows.maximize?
    @windows.update(id, { state: "minimized" });
  }
}

exports.window.unminimize = exports.popup.unminimize = function (id) {
  var state = @windows.get(id);

  // TODO test this
  if (state.state === "minimized") {
    // TODO do we need to set its state to minimized first, like with exports.windows.maximize?
    @windows.update(id, { state: "normal" });
  }
}

exports.window.maximize = exports.popup.maximize = function (id) {
  var state = @windows.get(id)

  // TODO test this
  if (state.state === "normal") {
    // TODO needed because Chrome is retarded
    @windows.update(id, { state: "normal" })
    @windows.update(id, { state: "maximized" })
  }
}

exports.window.unmaximize = exports.popup.unmaximize = function (id) {
  var state = @windows.get(id);

  // TODO test this
  if (state.state === "maximized") {
    // TODO do we need to set its state to maximized first, like with exports.windows.maximize?
    @windows.update(id, { state: "normal"/*, focused: false*/ });
  }
}

// TODO can popups be fullscreened ?
exports.window.fullscreen = function (id) {
  var state = @windows.get(id);

  // TODO test this
  if (state.state === "normal" || state.state === "maximized") {
    // TODO do we need to set its state to normal first, like with exports.windows.maximize?
    @windows.update(id, { state: "fullscreen" });
  }
}

// TODO can popups be fullscreened ?
exports.window.unfullscreen = function (id) {
  var state = @windows.get(id)

  // TODO test this
  if (state.state === "fullscreen") {
    // TODO do we need to set its state to fullscreen first, like with exports.windows.maximize?
    @windows.update(id, { state: "normal" });
  }
}

// TODO what about unfocus ?
exports.window.focus = exports.popup.focus = function (id) {
  @windows.update(id, { focused: true });
};

exports.window.move = exports.popup.move = function (id, info) {
  var state = @windows.get(id);

  // TODO test this
  if (state.state === "normal" || state.state === "maximized") {
    //windows_update(id, { state: "normal" })

    var o = {};
    o.state = "normal";
    setCoordinates(o, info);

    @windows.update(id, o);
    // TODO needed because Chrome is retarded
    //hold(100)
    //windows_update(id, o)
  }
};

exports.window.close = exports.popup.close = function (id) {
  @windows.close(id);
};


exports.tab.open = function (info) {
  var o = {}

  if (info.url != null) {
    o.url = info.url

  // This is unnecessary since Chrome defaults to the new tab page,
  // but I prefer being explicit about it
  } else {
    o.url = @url.newTab
  }

  if (info.pinned != null) {
    o.pinned = info.pinned
  }

  if (info.focused != null) {
    o.active = info.focused
  } else {
    o.active = true
  }

  var tab = @tabs.create(o);
  return tabs_by_id ..@get(tab.id);
}

exports.tab.update = function (id, info) {
  var o = {}

  if (info.url != null) {
    o.url = info.url
  }

  if (info.pinned != null) {
    o.pinned = info.pinned
  }

  @tabs.update(id, o)
}

exports.tab.focus = function (id) {
  var tab = @tabs.update(id, { active: true })

  // Chrome doesn't focus the window when focusing the tab,
  // so we have to do it manually in here
  // TODO would be nice to be able to do this in parallel with the tab update...
  // TODO test this
  exports.window.focus(tab.windowId)
}

exports.tab.close = function (id) {
  @tabs.remove(id);
}


exports.popup.init = function (push) {
  popups_publisher.subscribe(push);
  return popups;
};

exports.window.init = function (push) {
  windows_publisher.subscribe(push);
  return windows;
};


chrome.windows.onCreated.addListener(function (info) {
  @throwError();

  @assert.is(info.focused, false);

  if (info.tabs) {
    @assert.is(info.tabs.length, 0);
  }

  if (windows_isPopup(info)) {
    var popup = create_popup(info);

    popups_publisher.publish({
      type: exports.popup.on.open,
      popup: popup
    });

  } else if (windows_isNormal(info)) {
    var window = create_window(info);

    windows_publisher.publish({
      type: exports.window.on.open,
      window: window
    });
  }
});

/*chrome.windows.onFocusChanged.addListener(function (id) {
  @throwError();

  var old_popup  = unfocus_popup();
  var old_window = unfocus_window();

  // If focusing an incognito window, or if all Chrome windows become unfocused
  if (id !== chrome.windows.WINDOW_ID_NONE) {
    if (popups_by_id ..@has(id)) {
      var popup = popups_by_id ..@get(id);
      focus_popup(popup);

    } else if (windows_by_id ..@has(id)) {
      var window = windows_by_id ..@get(id);
      focus_window(window);
    }
  }

  if (old_popup !== focusedPopup) {
    popups_publisher.publish({
      type: exports.popup.on.focus,
      before: old_popup,
      after: focusedPopup
    });
  }

  if (old_window !== focusedWindow) {
    windows_publisher.publish({
      type: exports.window.on.focus,
      before: old_window,
      after: focusedWindow
    });
  }
});*/

chrome.windows.onRemoved.addListener(function (id) {
  @throwError();

  if (popups_by_id ..@has(id)) {
    var popup = popups_by_id ..@get(id);

    remove_popup(popup);

    popups_publisher.publish({
      type: exports.popup.on.close,
      popup: popup
    });

  } else if (windows_by_id ..@has(id)) {
    var window = windows_by_id ..@get(id);

    remove_window(window);

    windows_publisher.publish({
      type: exports.window.on.close,
      window: window
    });
  }
});

chrome.tabs.onCreated.addListener(function (info) {
  @throwError();

  // This is to make sure that it only triggers for normal windows
  if (windows_by_id ..@has(info.windowId)) {
    var tab = create_tab(info);

    windows_publisher.publish({
      type: exports.tab.on.open,
      tab: tab
    });
  }
})

chrome.tabs.onUpdated.addListener(function (id, info, tab) {
  @throwError();

  @assert.is(tab.id, id);

  if (tabs_by_id ..@has(id)) {
    emit_update_tab(tab);
  }
});

chrome.tabs.onReplaced.addListener(function (added, removed) {
  @throwError();

  @assert.isNot(added, removed);

  if (tabs_by_id ..@has(removed)) {
    var old = tabs_by_id ..@get(removed);
    tabs_by_id ..@delete(removed);
    tabs_by_id ..@setNew(added, old);

    old.id = added;

    windows_publisher.publish({
      type: exports.tab.on.replace,
      before: removed,
      after: added
    });

    // TODO is this part necessary ?
    var tab = tabs_get(added);
    console.debug("TABS.ONREPLACED", tab);
    @assert.is(tab.id, added);
    emit_update_tab(tab);
  }
});

chrome.tabs.onActivated.addListener(function (info) {
  @throwError();

  if (tabs_by_id ..@has(info.tabId)) {
    var tab = tabs_by_id ..@get(info.tabId);

    //var old = unfocus_tab(tab.window);
    var before = tab.window.focusedTab;
    focus_tab(tab.window, tab);

    windows_publisher.publish({
      type: exports.tab.on.focus,
      window: tab.window,
      before: before,
      after: tab
    });
  }
});

chrome.tabs.onMoved.addListener(function (id, info) {
  @throwError();

  if (tabs_by_id ..@has(id)) {
    var tab  = tabs_by_id ..@get(id);

    @assert.is(tab.index, info.fromIndex);
    move_from_to(tab.window.tabs, tab, info.toIndex);

    windows_publisher.publish({
      type: exports.tab.on.move,
      before: {
        window: tab.window,
        index: info.fromIndex,
        tab: tab
      },
      after: {
        window: tab.window,
        index: info.toIndex,
        tab: tab
      }
    });
  }
})

// TODO what about tab focus ?
chrome.tabs.onDetached.addListener(function (id, info) {
  @throwError();

  if (tabs_by_id ..@has(id)) {
    var tab = tabs_by_id ..@get(id);

    //defocus_tab(tab);
    remove_at(tab.window.tabs, tab);
  }
});

// TODO what about tab focus ?
chrome.tabs.onAttached.addListener(function (id, info) {
  @throwError();

  if (tabs_by_id ..@has(id)) {
    var tab    = tabs_by_id ..@get(id);
    var window = windows_by_id ..@get(info.newWindowId);

    // TODO what if the index changed after detaching but before attaching ?
    var old_window = tab.window;
    var old_index  = tab.index;

    tab.window = window;
    tab.index  = info.newPosition;

    insert_at(window.tabs, tab);

    windows_publisher.publish({
      type: exports.tab.on.move,
      before: {
        window: old_window,
        index: old_index,
        tab: tab
      },
      after: {
        window: tab.window,
        index: tab.index,
        tab: tab
      }
    });
  }
})

chrome.tabs.onRemoved.addListener(function (id, info) {
  @throwError();

  if (tabs_by_id ..@has(id)) {
    var tab = tabs_by_id ..@get(id);

    remove_tab(tab);

    windows_publisher.publish({
      type: exports.tab.on.close,
      // TODO a little hacky
      window: {
        closing: info.isWindowClosing // TODO probably not cross-platform with Jetpack
      },
      tab: tab
    });
  }
})


@windows.getAll() ..@each(function (info) {
  if (windows_isPopup(info)) {
    create_popup(info);

  } else if (windows_isNormal(info)) {
    create_window(info);
  }
});
