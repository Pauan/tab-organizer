/**
 * This stuff handles persisting tab IDs between sessions
 *
 * This module handles tab persistence in the following way:
 *
 *   1. Save an array of windows
 *   2. Each window has an id and array of tabs
 *   3. Each tab has an id and a url
 *   4. When Chrome starts, compare the Chrome windows to the saved windows
 *   5. To determine if a saved window matches a Chrome window, check
 *      that all the tabs in the saved window match the tab in the Chrome window,
 *      in order
 *   6. To determine if a saved tab matches a Chrome tab, compare their URLs
 *   7. It's okay if either window runs out of tabs before finishing the comparison:
 *      as long as at least one tab matched then it's counted as a success
 */
@ = require([
  { id: "sjs:collection/immutable" },
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" },
  { id: "sjs:object" },
  { id: "lib:util/util" },
  { id: "lib:extension/server" },
  { id: "./migrate", name: "migrate" }
])


var saved_windows = @migrate.db.get("session.windows.array", [])

function save() {
  @migrate.db.set("session.windows.array", saved_windows)
}

function save_delay() {
  // 10 seconds, so that when Chrome exits,
  // it doesn't clobber the user's data
  return @migrate.db.delay("session.windows.array", 10000, function () {
    return save()
  })
}


exports.init = function (push) {
  console.debug("server.session", "init");

  var windows_id = {};
  var tabs_id    = {};

  function windows_get(id) {
    return windows_id ..@get(id);
  }

  function tabs_get(id) {
    return tabs_id ..@get(id);
  }

  function update_tab(tab, info) {
    if (info.url !== tab.url) {
      if (info.url === void 0) {
        delete tab.url;
      } else {
        tab.url = info.url;
      }

      save();
    }
  }

  function insert_at(array, x, index) {
    @assert.ok(index != null);
    // TODO ..@push
    array.splice(index, 0, x);
    @assert.is(array[index], x);
  }

  function remove_at(array, x, index) {
    @assert.ok(index != null);
    @assert.is(array[index], x);
    // TODO ..@pop
    array.splice(index, 1);
    //window.tabs ..@remove(tab)
  }

  function windows_init(id, info) {
    var window = {
      id: id,
      tabs: []
    };

    windows_id ..@setNew(info.id, window);
    saved_windows ..@push(window);

    return window;
  }

  function tabs_init(id, window, info) {
    var tab = {
      id: id
    };

    tabs_id ..@setNew(info.id, tab);
    insert_at(window.tabs, tab, info.index);
    update_tab(tab, info);

    return tab;
  }


  function convert_window(info) {
    return @Dict({
      "id": windows_get(info.id).id,
      "private": info["private"], // TODO
      "focusedTab": (info.focusedTab === null
                      ? null
                      : info.focusedTab.index),
      "tabs": @List(info.tabs.map(convert_tab))
    });
  }

  function convert_tab(info) {
    return @Dict({
      "id": tabs_get(info.id).id,
      "url": info.url,
      "title": info.title,
      "pinned": info.pinned,
      "favicon": info.favicon
    });
  }


  var windows = @window.init(function (x) {
    var type = x.type;

    console.log(type);

    if (type === @window.on.open) {
      var id = @timestamp();

      @assert.is(x.window.tabs.length, 0);
      windows_init(id, x.window);

      save();

      return push({
        type: type,
        window: {
          index: x.window.index,
          value: convert_window(x.window)
        }
      });


    } else if (type === @window.on.close) {
      var window = windows_get(x.window.id);

      windows_id ..@delete(x.window.id);
      remove_at(saved_windows, window, x.window.index);

      save_delay();

      return push({
        type: type,
        window: {
          index: x.window.index
        }
      });


    } else if (type === @tab.on.open) {
      var id = @timestamp();

      var window = windows_get(x.tab.window.id);

      tabs_init(id, window, x.tab);

      save();

      return push({
        type: type,
        window: {
          index: x.tab.window.index
        },
        tab: {
          index: x.tab.index,
          value: convert_tab(x.tab)
        }
      });


    } else if (type === @tab.on.update) {
      var tab = tabs_get(x.tab.id);
      update_tab(tab, x.tab);

      return push({
        type: type,
        window: {
          index: x.tab.window.index
        },
        tab: {
          index: x.tab.index,
          value: convert_tab(x.tab)
        }
      });


    } else if (type === @tab.on.replace) {
      var tab = tabs_get(x.before);
      tabs_id ..@delete(x.before);
      tabs_id ..@setNew(x.after, tab);
      return true;


    } else if (type === @tab.on.focus) {
      return push({
        type: type,
        window: {
          index: x.after.window.index
        },
        tab: {
          index: x.after.index
        }
      });


    } else if (type === @tab.on.move) {
      var tab = tabs_get(x.before.tab.id);

      var window_before = windows_get(x.before.window.id);
      var window_after  = windows_get(x.after.window.id);
      remove_at(window_before.tabs, tab, x.before.index);
      insert_at(window_after.tabs,  tab, x.after.index);

      save();

      return push({
        type: type,
        before: {
          window: {
            index: x.before.window.index
          },
          tab: {
            index: x.before.index
          }
        },
        after: {
          window: {
            index: x.after.window.index
          },
          tab: {
            index: x.after.index
          }
        }
      });


    } else if (type === @tab.on.close) {
      var window  = windows_get(x.tab.window.id);
      var tab     = tabs_get(x.tab.id);
      var closing = x.window.closing; // TODO probably not compatible with Jetpack

      // TODO isBoolean check
      @assert.ok(closing === true || closing === false);

      tabs_id ..@delete(x.tab.id);
      remove_at(window.tabs, tab, x.tab.index);

      // TODO test whether this triggers or not when closing Chrome
      if (closing) {
        save_delay();
      } else {
        save();
      }

      return push({
        type: type,
        window: {
          closing: closing,
          index: x.tab.window.index
        },
        tab: {
          index: x.tab.index
        }
      });


    } else {
      @assert.fail();
    }
  });


  function tab_matches(tab_old, tab_new) {
    return tab_old.url === tab_new.url
  }

  function window_matches(window_old, window_new) {
    var tabs_old = window_old.tabs
    var tabs_new = window_new.tabs

    @assert.ok(tabs_old.length > 0)
    @assert.ok(tabs_new.length > 0)

    // Check that all the old tabs match with the new tabs
    return @zip(tabs_old, tabs_new) ..@all(function ([tab_old, tab_new]) {
      return tab_matches(tab_old, tab_new)
    })
  }

  function merge_new_window(window_old, window_new) {
    var window = windows_init(window_old.id, window_new)

    // TODO code duplication
    var tabs_old = window_old.tabs
    var tabs_new = window_new.tabs

    @assert.ok(tabs_old.length > 0)
    @assert.ok(tabs_new.length > 0)

    tabs_new ..@indexed ..@each(function ([i, tab_new]) {
      // Merge with existing tab
      if (i < tabs_old.length) {
        var tab_old = tabs_old[i]
        tabs_init(tab_old.id, window, tab_new)

      // Add new tab
      } else {
        // TODO allow for importers to choose the ID function ?
        var id = @timestamp()
        tabs_init(id, window, tab_new)
      }
    })

    console.info("session: merged #{tabs_new.length} tabs into window #{window_old.id}")
  }

  function create_new_window(window_new) {
    // TODO allow for importers to choose the ID function ?
    var id = @timestamp()

    var window = windows_init(id, window_new)

    // TODO code duplication
    var tabs_new = window_new.tabs
    @assert.ok(tabs_new.length > 0)

    tabs_new ..@each(function (tab_new) {
      // TODO allow for importers to choose the ID function ?
      var id = @timestamp()
      tabs_init(id, window, tab_new)
    })

    console.info("session: created new window #{window.id} with #{window.tabs.length} tabs")
  }

  function sync_init(array_new) {
    var array_old = saved_windows
    saved_windows = []

    array_new ..@indexed ..@each(function ([i, window_new]) {
      if (i < array_old.length) {
        var window_old = array_old[i]
        // New window matches the old window
        if (window_matches(window_old, window_new)) {
          merge_new_window(window_old, window_new)
        } else {
          create_new_window(window_new)
        }
      } else {
        create_new_window(window_new)
      }
    })

    // TODO this probably isn't necessary, but I like it just in case
    save()
  }


  console.log(windows);
  sync_init(windows);

  return @List(windows ..@map(convert_window));
};


function modify_tabs(state, index, f) {
  return state.modify(index, function (window) {
    return window.modify("tabs", function (tabs) {
      return f(tabs);
    });
  });
}

exports.step = function (state, event) {
  var type = event.type;
  if (type === @window.on.open) {
    return state.push(event.window.value, event.window.index);

  } else if (type === @window.on.close) {
    return state.pop(event.window.index);

  } else if (type === @tab.on.open) {
    return modify_tabs(state, event.window.index, function (tabs) {
      return tabs.push(event.tab.value, event.tab.index);
    });

  } else if (type === @tab.on.close) {
    return modify_tabs(state, event.window.index, function (tabs) {
      return tabs.pop(event.tab.index);
    });

  } else if (type === @tab.on.update) {
    return modify_tabs(state, event.window.index, function (tabs) {
      return tabs.modify(event.tab.index, function () {
        return event.tab.value;
      });
    });

  } else if (type === @tab.on.focus) {
    return state.modify(event.window.index, function (window) {
      return window.set("focusedTab", event.tab.index);
    });

  } else if (type === @tab.on.move) {
    var before = event.before;
    var after  = event.after;

    if (before.window.index === after.window.index) {
      return modify_tabs(state, before.window.index, function (tabs) {
        var tab = tabs.nth(before.tab.index);
        return tabs.pop(before.tab.index).push(tab, after.tab.index);
      });

    } else {
      var tab = state.nth(before.window.index).get("tabs").nth(before.tab.index);

      state = modify_tabs(state, before.window.index, function (tabs) {
        return tabs.pop(before.tab.index);
      });

      state = modify_tabs(state, after.window.index, function (tabs) {
        return tabs.push(tab, after.tab.index);
      });

      return state;
    }

  } else {
    @assert.fail();
  }
};



/*var events = (function (events) {
  var delayed_events  = null  // When delaying events, this will be an array
  var delayed_counter = 0     // This is the number of functions that are delaying events

  exports.changes = @Emitter();

  // TODO test this
  exports.delayEvents = function (f) {
    ++delayed_counter

    if (delayed_events === null) {
      @assert.is(delayed_counter, 1)
      delayed_events = []
    }

    try {
      return f()
    } finally {
      if (--delayed_counter === 0) {
        var a = delayed_events
        delayed_events = null
        a ..@each(function (x) {
          exports.changes ..@emit(x)
        })
      }
    }
  }

  events.emit = function (o) {
    if (delayed_events !== null) {
      // TODO is pushNew needed?
      delayed_events ..@pushNew(o)
    } else {
      exports.changes ..@emit(o)
    }
  };

  return events;
})({});*/