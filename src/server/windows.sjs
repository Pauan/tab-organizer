@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:collection/immutable" },
  { id: "sjs:sequence" },
  { id: "sjs:type" },
  { id: "lib:util/util" },
  { id: "./db", name: "db" },
  { id: "./session", name: "session" }
]);


function save(x) {
  @db.set("current.tab-ids", x.get("tab-ids"));
  @db.set("current.window-ids", x.get("window-ids"));
  @db.set("current.windows", x.get("windows"));
  return x;
}

// TODO this is specific to Chrome...?
// TODO test this again, to make sure it's working
// TODO code duplication with session
function save_delay(x) {
  // 10 seconds, so that when Chrome exits,
  // it doesn't clobber the user's data
  var timeout = 10000;
  @db.delay("current.tab-ids", timeout);
  @db.delay("current.window-ids", timeout);
  @db.delay("current.windows", timeout);
  return save(x);
}

function insert_next(array, x, next) {
  if (next === null) {
    return array.insert(x);
  } else {
    var index = array ..@indexOf(next, null);
    if (index === null) {
      return array.insert(x);
    } else {
      return array.insert(x, index);
    }
  }
}

function update_window(window, info) {
  var focused = info.get("focused-tab");

  if (focused === null) {
    window = window.remove("focused-tab");
  } else {
    window = window.set("focused-tab", focused);
  }

  return window;
}

function update_tab(tab, info) {
  var url     = info.get("url");
  var title   = info.get("title");
  var pinned  = info.get("pinned");
  var favicon = info.get("favicon");

  tab = tab.set("active", 1);

  if (url == null) {
    tab = tab.remove("url");
  } else {
    tab = tab.set("url", url);
  }

  if (title == null) {
    tab = tab.remove("title");
  } else {
    tab = tab.set("title", title);
  }

  if (pinned) {
    tab = tab.set("pinned", 1);
  } else {
    tab = tab.remove("pinned");
  }

  if (favicon == null) {
    tab = tab.remove("favicon");
  } else {
    tab = tab.set("favicon", favicon);
  }

  return tab;
}

function update_timestamp(tab, name) {
  return tab.modify("time", function (time) {
    return time.set(name, @timestamp());
  });
}

function update_tab_with_timestamp(tab, info) {
  var new_tab = update_tab(tab, info);
  if (new_tab !== tab) {
    new_tab = new_tab ..update_timestamp("updated");
  }
  return new_tab;
}

function modify_window_tabs(state, window_id, f) {
  return state.modify("window-ids", function (ids) {
    return ids.modify(window_id, function (window) {
      return window.modify("tabs", function (tabs) {
        return f(tabs);
      });
    });
  });
}


exports.on              = {};

exports.on.init         = "__A1980762-F797-47C6-AA36-8F6ADC2AD765_init__";

exports.on.window_open  = "__2DAC0FE5-F05F-43BF-8499-F872ADD00AA3_window_open__";
exports.on.window_close = "__820C4C8D-CF16-4878-8E62-0E059371D209_window_close__";

exports.on.tab_open     = "__8B19CC55-1424-4E4A-9B43-B5911E558063_tab_open__";
exports.on.tab_update   = "__4207D5F0-E8E3-4500-9E29-DE3196BEEDB0_tab_update__";
exports.on.tab_focus    = "__5B412193-2FD4-4C8E-926D-558086889097_tab_focus__";
exports.on.tab_move     = "__3543E7DC-9D6D-4CEF-872C-D40846EEB4FC_tab_move__";
exports.on.tab_close    = "__7835FF1E-6EE2-44AE-B5A9-6524EF2344AD_tab_close__";


function remove_window(state, id) {
  var window = null;

  state = state.modify("window-ids", function (ids) {
    window = ids.get(id);
    return ids.remove(id);
  });

  @assert.isNot(window, null);

  state = state.modify("windows", function (windows) {
    return windows.remove(windows ..@indexOf(id));
  });

  var window_tabs = window.get("tabs");
  if (!window_tabs.isEmpty()) {
    state = state.modify("tab-ids", function (ids) {
      window_tabs ..@each(function (id) {
        ids = ids.remove(id);
      });

      return ids;
    });
  }

  return state;
}

function remove_tab_from_window(state, window_id, tab_id) {
  var remove = false;

  state = state.modify("window-ids", function (ids) {
    var window = ids.get(window_id);

    if (window.has("focused-tab") && window.get("focused-tab") === tab_id) {
      window = window.remove("focused-tab");
    }

    window = window.modify("tabs", function (tabs) {
      tabs = tabs.remove(tabs ..@indexOf(tab_id));

      if (tabs.isEmpty()) {
        remove = true;
      }

      return tabs;
    });

    // TODO hacky
    if (remove) {
      ids = ids.remove(window_id);
    } else {
      ids = ids.set(window_id, window);
    }

    return ids;
  });

  if (remove) {
    // TODO code duplication
    state = state.modify("windows", function (windows) {
      return windows.remove(windows ..@indexOf(window_id));
    });
  }

  return state;
}

function remove_tab(state, id) {
  var tab = null;

  state = state.modify("tab-ids", function (ids) {
    tab = ids.get(id);
    return ids.remove(id);
  });

  @assert.isNot(tab, null);

  state = remove_tab_from_window(state, tab.get("window"), id);

  return state;
}

function unload_tab(state, id) {
  state = state.modify("unloaded-tabs", function (unloaded_tabs) {
    return unloaded_tabs.add(id);
  });

  state = state.modify("tab-ids", function (ids) {
    return ids.modify(id, function (tab) {
      return tab.remove("active");
    });
  });

  @session.tab.close(id);

  return state;
}


/*function find_duplicates(state) {
  var seen = {};
  var out  = [];

  var window_ids = state.get("window-ids");
  var tab_ids    = state.get("tab-ids");

  state.get("windows") ..@each(function (id) {
    var window = window_ids.get(id);
    if (!window.has("name")) {
      window.get("tabs") ..@each(function (id) {
        var tab = tab_ids.get(id);

        var url = tab.get("url", null);
        if (url !== null) {
          if (!seen[url]) {
            seen[url] = 0;
          }
          ++seen[url];

          out.push(tab);
        }
      });
    }
  });

  return out.filter(function (tab) {
    var url = tab.get("url");
    return seen[url] > 1;
  });
}*/


/*function get_window_for_tab(state, tab) {
  return state.get("window-ids").get(tab.get("window"));
}*/


exports.init = function (push) {
  function get(array, index) {
    var next = array.get(index, null);
    if (next === null) {
      return null;
    } else {
      return next.get("id");
    }
  }

  function get_tab(win_index, tab_index) {
    return session.get(win_index).get("tabs") ..get(tab_index);
  }

  function make_window_tabs(window) {
    return @List(window.get("tabs") ..@transform(function (tab) {
      return tab.get("id");
    }));
  }

  function make_window(window, tabs) {
    return @Dict({
      "id": window.get("id"),
      "time": @Dict({
        "created": @timestamp()
      }),
      "tabs": tabs
    }) ..update_window(window);
  }

  function make_tab(tab, window) {
    return @Dict({
      "id": tab.get("id"),
      "window": window,
      "time": @Dict({
        "created": @timestamp()
      })
    }) ..update_tab(tab);
  }

  var session = @session.init(function (event) {
    // TODO what if this is called before @session.init returns ?
    session = @session.step(session, event);

    var type = event.get("type");

    if (type === @session.on.window_open) {
      var window       = event.get("window");
      var window_index = event.get("window-index");

      return push(@Dict({
        "type": exports.on.window_open,
        "window-next": session ..get(window_index + 1),
        "window": make_window(window, make_window_tabs(window))
      }));

    } else if (type === @session.on.window_close) {
      return push(@Dict({
        "type": exports.on.window_close,
        "window-id": event.get("window-id")
      }));

    } else if (type === @session.on.tab_open) {
      return push(@Dict({
        "type": exports.on.tab_open,
        "tab-next": get_tab(event.get("window-index"), event.get("tab-index") + 1),
        "tab": make_tab(event.get("tab"), event.get("window-id"))
      }));

    } else if (type === @session.on.tab_update) {
      return push(@Dict({
        "type": exports.on.tab_update,
        "tab": event.get("tab")
      }));

    } else if (type === @session.on.tab_focus) {
      return push(@Dict({
        "type": exports.on.tab_focus,
        // TODO is this unnecessary ?
        "window-id": event.get("window-id"),
        "tab-id": event.get("tab-id")
      }));

    } else if (type === @session.on.tab_move) {
      //var before = event.get("before");
      var after  = event.get("after");

      // TODO
      /*if (event.before.window.id === event.after.window.id &&
          event.before.tab.index < event.after.tab.index) {

      } else {*/
        var next = get_tab(after.get("window-index"), after.get("tab-index") + 1);
      //}
      return push(@Dict({
        "type": exports.on.tab_move,
        "window-id": after.get("window-id"),
        "tab-id": after.get("tab-id"),
        "tab-next": next
      }));

    } else if (type === @session.on.tab_close) {
      return push(@Dict({
        "type": exports.on.tab_close,
        "window-closing": event.get("window-closing"),
        "tab-id": event.get("tab-id")
      }));

    } else {
      @assert.fail();
    }
  });


  /*var state = @Dict({
    "unloaded-tabs" : @Set(),
    "tab-ids"       : @db.get("current.tab-ids",    @Dict()),
    "window-ids"    : @db.get("current.window-ids", @Dict()),
    "windows"       : @db.get("current.windows",    @List())
  });*/

  var tab_ids = @db.get("current.tab-ids",    @Dict());
  var window_ids = @db.get("current.window-ids", @Dict());
  var windows = @db.get("current.windows",    @List());


  var seen_windows = {};
  var seen_tabs    = {};

  var reset_start = Date.now();

  window_ids ..@each(function ([id, window]) {
    @assert.notOk(window.get("tabs").isEmpty());

    windows ..@indexOf(id);

    window.get("tabs") ..@each(function (id) {
      @assert.ok(tab_ids.has(id));
      @assert.ok(!seen_tabs[id]);
      seen_tabs[id] = true;
    });

    // Reset focused tab for unloaded windows
    window_ids = window_ids.set(id, window.remove("focused-tab"));
  });

  tab_ids ..@each(function ([id, tab]) {
    var window = window_ids.get(tab.get("window"));

    window.get("tabs") ..@indexOf(id);

    // Reset active tab for unloaded tabs
    tab_ids = tab_ids.set(id, tab.remove("active"));
  });

  windows ..@each(function (id) {
    @assert.ok(window_ids.has(id));
    @assert.ok(!seen_windows[id]);
    seen_windows[id] = true;
  });

  var reset_end = Date.now();

  console.info("windows: resetting took #{reset_end - reset_start}ms");


  var merge_start = Date.now();

  // Merge with active windows
  session ..@indexed ..@each(function ([i, info]) {
    var window_id   = info.get("id");
    var window_tabs = info.get("tabs");

    if (window_ids.has(window_id)) {
      var window = window_ids.get(window_id) ..update_window(info);

    } else {
      var window = make_window(info, @List());
      var next   = session ..get(i + 1);
      windows = windows ..insert_next(window_id, next);
    }

    window_tabs ..@indexed ..@each(function ([i, info]) {
      var tab_id = info.get("id");

      if (tab_ids.has(tab_id)) {
        var tab = tab_ids.get(tab_id) ..update_tab_with_timestamp(info);

      } else {
        var tab  = make_tab(info, window_id);
        var next = window_tabs ..get(i + 1);
        window = window.modify("tabs", function (tabs) {
          return tabs ..insert_next(tab_id, next);
        });
      }

      tab_ids = tab_ids.set(tab_id, tab);
    });

    window_ids = window_ids.set(window_id, window);
  });

  var merge_end = Date.now();

  console.info("windows: merging took #{merge_end - merge_start}ms");


  // Migrate old window titles to the new system
  // TODO hacky that this is in here, rather than in migrate.sjs
  if (@db.has("window.titles")) {
    @zip(session, @db.get("window.titles")) ..@each(function ([info, title]) {
      var id     = info.get("id");
      var window = window_ids.get(id);

      window = window.set("name", title);

      window_ids = window_ids.set(id, window);
    });

    @db.remove("window.titles");
  }


  var state = @Dict({
    "unloaded-tabs": @Set(),
    "tab-ids": tab_ids,
    "window-ids": window_ids,
    "windows": windows
  });

  return save(state);
};


exports.step = function (state, event) {
  var type = event.get("type");

  if (type === exports.on.window_open) {
    var window    = event.get("window");
    var window_id = window.get("id");

    state = state.modify("window-ids", function (ids) {
      return ids.set(window_id, window);
    });

    state = state.modify("windows", function (windows) {
      return windows ..insert_next(window_id, event.get("window-next"));
    });

    save(state);

  } else if (type === exports.on.window_close) {
    state = remove_window(state, event.get("window-id"));

    save_delay(state);

  } else if (type === exports.on.tab_open) {
    var tab       = event.get("tab");
    var tab_id    = tab.get("id");
    var window_id = tab.get("window");

    state = state.modify("tab-ids", function (ids) {
      return ids.set(tab_id, tab);
    });

    state = modify_window_tabs(state, window_id, function (tabs) {
      return tabs ..insert_next(tab_id, event.get("tab-next"));
    });

    save(state);

  } else if (type === exports.on.tab_update) {
    var tab = event.get("tab");

    state = state.modify("tab-ids", function (ids) {
      return ids.modify(tab.get("id"), function (x) {
        return x ..update_tab_with_timestamp(tab);
      });
    });

    save(state);

  } else if (type === exports.on.tab_focus) {
    var tab_id = event.get("tab-id");

    var old_focused = null;

    state = state.modify("window-ids", function (ids) {
      return ids.modify(event.get("window-id"), function (window) {
        if (window.has("focused-tab")) {
          old_focused = window.get("focused-tab");
        }
        return window.set("focused-tab", tab_id);
      });
    });

    state = state.modify("tab-ids", function (ids) {
      if (old_focused !== null && ids.has(old_focused)) {
        ids = ids.modify(old_focused, function (tab) {
          return tab ..update_timestamp("unfocused");
        });
      }

      ids = ids.modify(tab_id, function (tab) {
        return tab ..update_timestamp("focused");
      });

      return ids;
    });

    save(state);

  } else if (type === exports.on.tab_move) {
    var tab_id     = event.get("tab-id");
    var tab_next   = event.get("tab-next");
    var new_window = event.get("window-id");
    var old_window = null;

    state = state.modify("tab-ids", function (ids) {
      return ids.modify(tab_id, function (tab) {
        old_window = tab.get("window");

        tab = tab.set("window", new_window);

        if (old_window === new_window) {
          tab = tab ..update_timestamp("moved-in-window");
        } else {
          tab = tab ..update_timestamp("moved-to-window");
        }

        return tab;
      });
    });

    @assert.isNot(old_window, null);

    if (old_window === new_window) {
      // TODO code duplication
      state = modify_window_tabs(state, old_window, function (tabs) {
        return tabs.remove(tabs ..@indexOf(tab_id)) ..insert_next(tab_id, tab_next);
      });

    } else {
      state = modify_window_tabs(state, old_window, function (tabs) {
        return tabs.remove(tabs ..@indexOf(tab_id));
      });

      state = modify_window_tabs(state, new_window, function (tabs) {
        return tabs ..insert_next(tab_id, tab_next);
      });
    }

    save(state);

  } else if (type === exports.on.tab_close) {
    state = remove_tab(state, event.get("tab-id"));

    if (event.get("window-closing")) {
      save_delay(state);
    } else {
      save(state);
    }
  }

  return state;
};
