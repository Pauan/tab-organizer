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
  { id: "./db", name: "db" }
]);


exports.on              = {};

exports.on.window_open  = "__AC31B105-BEC4-40B1-92E2-6DE232F406EA_window_open__";
exports.on.window_close = "__916E2D04-C40B-46E1-A8A6-99A0FED7F9AE_window_close__";

exports.on.tab_open     = "__6AD6EDDF-6C17-4852-9591-F7B54050D25D_tab_open__";
exports.on.tab_update   = "__85E47065-BF84-436F-8ED4-87E04FE09467_tab_update__";
exports.on.tab_focus    = "__0DDC2E41-DDCF-40F2-8B33-FBC50F9E548D_tab_focus__";
exports.on.tab_move     = "__94D9748F-026A-4E35-96F7-AF8A19880375_tab_move__";
exports.on.tab_close    = "__C0A6B1FD-708F-47FE-A48F-E981C02AB36C_tab_close__";

exports.init = function (push) {
  console.debug("server.session:", "init");

  var db_name = "session.windows";

  var saved_windows = @db.get(db_name, @List());

  function save() {
    @db.set(db_name, saved_windows);
  }

  function save_delay() {
    // 10 seconds, so that when Chrome exits,
    // it doesn't clobber the user's data
    @db.delay(db_name, 10000)
    return save();
  }

  var windows_id = {};
  var tabs_id    = {};

  function update_tab(tab, info) {
    if (info.url == null) {
      return tab.remove("url");
    } else {
      return tab.set("url", info.url);
    }
  }

  function windows_init(id, info) {
    var window = @Dict({
      "id": id,
      "tabs": @List()
    });

    windows_id ..@setNew(info.id, id);

    saved_windows = saved_windows.insert(window);

    save();
  }

  function modify_tabs(index, f) {
    saved_windows = saved_windows.modify(index, function (window) {
      return window.modify("tabs", function (tabs) {
        return f(tabs);
      });
    });
  }

  function tabs_init(id, info) {
    var tab = @Dict({
      "id": id
    }) ..update_tab(info);

    tabs_id ..@setNew(info.id, id);

    modify_tabs(info.window.index, function (tabs) {
      return tabs.insert(tab, info.index);
    });

    save();
  }


  function convert_window(info) {
    return @Dict({
      "id": windows_id ..@get(info.id),
      "private": info["private"], // TODO
      "focused-tab": (info.focusedTab === null
                       ? null
                       : tabs_id ..@get(info.focusedTab.id)),
      "tabs": @List(info.tabs ..@transform(convert_tab))
    });
  }

  function convert_tab(info) {
    return @Dict({
      "id": tabs_id ..@get(info.id),
      "url": info.url,
      "title": info.title,
      "pinned": info.pinned,
      "favicon": info.favicon
    });
  }


  var windows = @window.init(function (x) {
    var type = x.type;

    if (type === @window.on.open) {
      var id = "" + @timestamp();

      @assert.is(x.window.tabs.length, 0);
      windows_init(id, x.window);

      return push({
        type: exports.on.window_open,
        window: {
          id: id,
          index: x.window.index,
          value: convert_window(x.window)
        }
      });


    } else if (type === @window.on.close) {
      var win_id = windows_id ..@get(x.window.id);

      windows_id ..@delete(x.window.id);

      saved_windows = saved_windows.remove(x.window.index);

      save_delay();

      return push({
        type: exports.on.window_close,
        window: {
          id: win_id,
          index: x.window.index
        }
      });


    } else if (type === @tab.on.open) {
      var id = "" + @timestamp();

      var win_id = windows_id ..@get(x.tab.window.id);

      tabs_init(id, x.tab);

      return push({
        type: exports.on.tab_open,
        window: {
          id: win_id,
          index: x.tab.window.index
        },
        tab: {
          id: id,
          index: x.tab.index,
          value: convert_tab(x.tab)
        }
      });


    } else if (type === @tab.on.update) {
      var info = x.tab;

      var win_id = windows_id ..@get(info.window.id);
      var tab_id = tabs_id ..@get(info.id);

      modify_tabs(info.window.index, function (tabs) {
        return tabs.modify(info.index, function (tab) {
          return update_tab(tab, info);
        });
      });

      save();

      return push({
        type: exports.on.tab_update,
        window: {
          id: win_id,
          index: info.window.index
        },
        tab: {
          id: tab_id,
          index: info.index,
          value: convert_tab(info)
        }
      });


    } else if (type === @tab.on.replace) {
      var tab = tabs_id ..@get(x.before);
      tabs_id ..@delete(x.before);
      tabs_id ..@setNew(x.after, tab);
      return true;


    } else if (type === @tab.on.focus) {
      var win_id = windows_id ..@get(x.window.id);
      var tab_id = tabs_id ..@get(x.after.id);

      return push({
        type: exports.on.tab_focus,
        window: {
          id: win_id,
          index: x.after.window.index
        },
        tab: {
          id: tab_id,
          index: x.after.index
        }
      });


    } else if (type === @tab.on.move) {
      var before_win_id = windows_id ..@get(x.before.window.id);
      var after_win_id  = windows_id ..@get(x.after.window.id);
      var tab_id = tabs_id ..@get(x.after.tab.id);

      var tab = null;

      modify_tabs(x.before.window.index, function (tabs) {
        tab = tabs.get(x.before.index);
        return tabs.remove(x.before.index);
      });

      @assert.isNot(tab, null);

      modify_tabs(x.after.window.index, function (tabs) {
        return tabs.insert(tab, x.after.index);
      });

      save();

      return push({
        type: exports.on.tab_move,
        before: {
          window: {
            id: before_win_id,
            index: x.before.window.index
          },
          tab: {
            id: tab_id,
            index: x.before.index
          }
        },
        after: {
          window: {
            id: after_win_id,
            index: x.after.window.index
          },
          tab: {
            id: tab_id,
            index: x.after.index
          }
        }
      });


    } else if (type === @tab.on.close) {
      var win_id = windows_id ..@get(x.tab.window.id);
      var tab_id = tabs_id ..@get(x.tab.id);

      tabs_id ..@delete(x.tab.id);

      modify_tabs(x.tab.window.index, function (tabs) {
        return tabs.remove(x.tab.index);
      });

      var closing = x.window.closing; // TODO probably not compatible with Jetpack

      // TODO isBoolean check
      @assert.ok(closing === true || closing === false);

      // TODO test whether this triggers or not when closing Chrome
      if (closing) {
        save_delay();
      } else {
        save();
      }

      return push({
        type: exports.on.tab_close,
        window: {
          id: win_id,
          closing: closing,
          index: x.tab.window.index
        },
        tab: {
          id: tab_id,
          index: x.tab.index
        }
      });


    } else {
      @assert.fail();
    }
  });


  function tab_matches(tab_old, tab_new) {
    if (tab_new.url == null) {
      return !tab_old.has("url");
    } else {
      return tab_old.has("url") && tab_old.get("url") === tab_new.url;
    }
  }

  function window_matches(window_old, window_new) {
    var tabs_old = window_old.get("tabs");
    var tabs_new = window_new.tabs;

    @assert.ok(tabs_old.size() > 0);
    @assert.ok(tabs_new.length > 0);

    // Check that all the old tabs match with the new tabs
    return @zip(tabs_old, tabs_new) ..@all(function ([tab_old, tab_new]) {
      return tab_matches(tab_old, tab_new);
    });
  }

  function merge_new_window(window_old, window_new) {
    var old_id = window_old.get("id");
    windows_init(old_id, window_new);

    // TODO code duplication
    var tabs_old = window_old.get("tabs");
    var tabs_new = window_new.tabs;

    @assert.ok(tabs_old.size() > 0);
    @assert.ok(tabs_new.length > 0);

    tabs_new ..@indexed ..@each(function ([i, tab_new]) {
      // Merge with existing tab
      if (tabs_old.has(i)) {
        var tab_old = tabs_old.get(i);
        tabs_init(tab_old.get("id"), tab_new);

      // Add new tab
      } else {
        // TODO allow for importers to choose the ID function ?
        var id = "" + @timestamp();
        tabs_init(id, tab_new);
      }
    });

    console.info("session: merged #{tabs_new.length} tabs into window #{old_id}");
  }

  function create_new_window(window_new) {
    // TODO allow for importers to choose the ID function ?
    var id = "" + @timestamp();
    windows_init(id, window_new);

    // TODO code duplication
    var tabs_new = window_new.tabs;
    @assert.ok(tabs_new.length > 0);

    tabs_new ..@each(function (tab_new) {
      // TODO allow for importers to choose the ID function ?
      var id = "" + @timestamp();
      tabs_init(id, tab_new);
    });

    console.info("session: created new window #{id} with #{tabs_new.length} tabs");
  }

  function sync_init(array_new) {
    var array_old = saved_windows;
    saved_windows = @List();

    array_new ..@indexed ..@each(function ([i, window_new]) {
      if (array_old.has(i)) {
        var window_old = array_old.get(i);
        // New window matches the old window
        if (window_matches(window_old, window_new)) {
          merge_new_window(window_old, window_new);
        } else {
          create_new_window(window_new);
        }
      } else {
        create_new_window(window_new);
      }
    })

    // TODO this probably isn't necessary, but I like it just in case
    save();
  }

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
  if (type === exports.on.window_open) {
    return state.insert(event.window.value, event.window.index);

  } else if (type === exports.on.window_close) {
    return state.remove(event.window.index);

  } else if (type === exports.on.tab_open) {
    return modify_tabs(state, event.window.index, function (tabs) {
      return tabs.insert(event.tab.value, event.tab.index);
    });

  } else if (type === exports.on.tab_close) {
    return modify_tabs(state, event.window.index, function (tabs) {
      return tabs.remove(event.tab.index);
    });

  } else if (type === exports.on.tab_update) {
    return modify_tabs(state, event.window.index, function (tabs) {
      return tabs.modify(event.tab.index, function () {
        return event.tab.value;
      });
    });

  } else if (type === exports.on.tab_focus) {
    return state.modify(event.window.index, function (window) {
      return window.set("focused-tab", event.tab.id);
    });

  } else if (type === exports.on.tab_move) {
    var before = event.before;
    var after  = event.after;

    if (before.window.index === after.window.index) {
      return modify_tabs(state, before.window.index, function (tabs) {
        var tab = tabs.get(before.tab.index);
        return tabs.remove(before.tab.index).insert(tab, after.tab.index);
      });

    } else {
      var tab = state.get(before.window.index).get("tabs").get(before.tab.index);

      state = modify_tabs(state, before.window.index, function (tabs) {
        return tabs.remove(before.tab.index);
      });

      state = modify_tabs(state, after.window.index, function (tabs) {
        return tabs.insert(tab, after.tab.index);
      });

      return state;
    }

  } else {
    return state;
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
