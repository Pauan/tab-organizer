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

exports.on.window_open  = "__2DAC0FE5-F05F-43BF-8499-F872ADD00AA3_window_open__";
exports.on.window_close = "__820C4C8D-CF16-4878-8E62-0E059371D209_window_close__";

exports.on.tab_open     = "__8B19CC55-1424-4E4A-9B43-B5911E558063_tab_open__";
exports.on.tab_update   = "__4207D5F0-E8E3-4500-9E29-DE3196BEEDB0_tab_update__";
exports.on.tab_focus    = "__5B412193-2FD4-4C8E-926D-558086889097_tab_focus__";
exports.on.tab_move     = "__3543E7DC-9D6D-4CEF-872C-D40846EEB4FC_tab_move__";
exports.on.tab_close    = "__7835FF1E-6EE2-44AE-B5A9-6524EF2344AD_tab_close__";


/*function remove_window(state, id) {
  state = state.modify("window-ids", function (ids) {
    return ids.remove(id);
  });

  state = state.modify("windows", function (windows) {
    return windows.remove(windows ..@indexOf(id));
  });

  return state;
}*/

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

  /*if (tab === null) {
    state.get("window-ids") ..@each(function ([win_id, window]) {
      state = remove_tab_from_window(state, win_id, id);
    });
  } else {*/
  @assert.isNot(tab, null);

  state = remove_tab_from_window(state, tab.get("window"), id);
  //}

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
  console.info("server.windows:", "init");

  var tab_ids    = @db.get("current.tab-ids", @Dict());
  var window_ids = @db.get("current.window-ids", @Dict());
  var windows    = @db.get("current.windows", @List());

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

  function make_window(window) {
    return @Dict({
      "id": window.get("id"),
      "time": @Dict({
        "created": @timestamp()
      }),
      "tabs": @List(window.get("tabs") ..@transform(function (tab) {
        return tab.get("id");
      }))
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

    var type = event.type;
    if (type === @session.on.window_open) {
      return push({
        type: exports.on.window_open,
        window: {
          id: event.window.id,
          next: session ..get(event.window.index + 1),
          value: make_window(event.window.value)
        }
      });

    } else if (type === @session.on.window_close) {
      return push({
        type: exports.on.window_close,
        window: {
          id: event.window.id
        }
      });

    } else if (type === @session.on.tab_open) {
      return push({
        type: exports.on.tab_open,
        window: {
          id: event.window.id
        },
        tab: {
          id: event.tab.id,
          next: get_tab(event.window.index, event.tab.index + 1),
          value: make_tab(event.tab.value, event.window.id)
        }
      });

    } else if (type === @session.on.tab_update) {
      return push({
        type: exports.on.tab_update,
        tab: {
          id: event.tab.id,
          value: event.tab.value.remove("id")
        }
      });

    } else if (type === @session.on.tab_focus) {
      return push({
        type: exports.on.tab_focus,
        window: {
          id: event.window.id
        },
        tab: {
          id: event.tab.id
        }
      });

    } else if (type === @session.on.tab_move) {
      return push({
        type: exports.on.tab_move,
        before: {
          window: {
            id: event.before.window.id
          }
        },
        after: {
          window: {
            id: event.after.window.id
          },
          tab: {
            id: event.after.tab.id,
            next: get_tab(event.after.window.index, event.after.tab.index + 1)
          }
        }
      });

    } else if (type === @session.on.tab_close) {
      return push({
        type: exports.on.tab_close,
        window: {
          id: event.window.id,
          closing: event.window.closing
        },
        tab: {
          id: event.tab.id
        }
      });

    } else {
      @assert.fail();
    }
  });

  // Reset focused tab for unloaded windows
  window_ids ..@each(function ([id, window]) {
    @assert.notOk(window.get("tabs").isEmpty());
    window_ids = window_ids.set(id, window.remove("focused-tab"));
  });

  // Reset active tab for unloaded tabs
  tab_ids ..@each(function ([id, tab]) {
    tab_ids = tab_ids.set(id, tab.remove("active"));
  });

  // Merge with active windows
  session ..@indexed ..@each(function ([i, info]) {
    var window_id   = info.get("id");
    var window_tabs = info.get("tabs");

    if (window_ids.has(window_id)) {
      var window = window_ids.get(window_id) ..update_window(info);

    } else {
      var window = make_window(info);
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


  // Migrate old window titles to the new system
  // TODO hacky that this is in here, rather than in migrate.sjs
  // TODO test this
  if (@db.has("window.titles")) {
    @zip(session, @db.get("window.titles")) ..@each(function ([info, title]) {
      console.log(info, title);

      var id     = info.get("id");
      var window = window_ids.get(id);

      window = window.set("name", title);

      window_ids = window_ids.set(id, window);
    });

    @db.remove("window.titles");
  }


  var state = @Dict({
    "tab-ids": tab_ids,
    "window-ids": window_ids,
    "windows": windows
  });

  /* .filter(function (x) {
    return x.get("url") === "chrome://newtab/";
  })*/

  //console.log(find_duplicates(state).map(@toJS));

  /*state = find_duplicates(state).reduce(function (state, tab) {
    console.log("" + tab);
    return remove_tab(state, tab.get("id"));
  }, state);*/

  return save(state);
};


exports.step = function (state, event) {
  var type = event.type;

  if (type === exports.on.window_open) {
    state = state.modify("window-ids", function (ids) {
      return ids.set(event.window.id, event.window.value);
    });

    state = state.modify("windows", function (windows) {
      return windows ..insert_next(event.window.id, event.window.next);
    });

    save(state);

  } else if (type === exports.on.window_close) {
    state = state.modify("window-ids", function (ids) {
      return ids.remove(event.window.id);
    });

    state = state.modify("windows", function (windows) {
      return windows.remove(windows ..@indexOf(event.window.id));
    });

    save_delay(state);

  } else if (type === exports.on.tab_open) {
    state = state.modify("tab-ids", function (ids) {
      return ids.set(event.tab.id, event.tab.value);
    });

    state = modify_window_tabs(state, event.window.id, function (tabs) {
      return tabs ..insert_next(event.tab.id, event.tab.next);
    });

    save(state);

  } else if (type === exports.on.tab_update) {
    state = state.modify("tab-ids", function (ids) {
      return ids.modify(event.tab.id, function (tab) {
        return tab ..update_tab_with_timestamp(event.tab.value);
      });
    });

    save(state);

  } else if (type === exports.on.tab_focus) {
    var old_focused = null;

    state = state.modify("window-ids", function (ids) {
      return ids.modify(event.window.id, function (window) {
        if (window.has("focused-tab")) {
          old_focused = window.get("focused-tab");
        }
        return window.set("focused-tab", event.tab.id);
      });
    });

    state = state.modify("tab-ids", function (ids) {
      if (old_focused !== null && ids.has(old_focused)) {
        ids = ids.modify(old_focused, function (tab) {
          return tab ..update_timestamp("unfocused");
        });
      }

      ids = ids.modify(event.tab.id, function (tab) {
        return tab ..update_timestamp("focused");
      });

      return ids;
    });

    save(state);

  } else if (type === exports.on.tab_move) {
    var tab_id = event.after.tab.id;

    state = modify_window_tabs(state, event.before.window.id, function (tabs) {
      return tabs.remove(tabs ..@indexOf(tab_id));
    });

    state = modify_window_tabs(state, event.after.window.id, function (tabs) {
      return tabs ..insert_next(tab_id, event.after.tab.next);
    });

    state = state.modify("tab-ids", function (ids) {
      return ids.modify(tab_id, function (tab) {
        tab = tab.set("window", event.after.window.id);

        if (event.before.window.id === event.after.window.id) {
          tab = tab ..update_timestamp("moved-in-window");
        } else {
          tab = tab ..update_timestamp("moved-to-window");
        }

        return tab;
      });
    });

    save(state);

  } else if (type === exports.on.tab_close) {
    state = state.modify("tab-ids", function (ids) {
      return ids.remove(event.tab.id);
    });

    state = modify_window_tabs(state, event.window.id, function (tabs) {
      return tabs.remove(tabs ..@indexOf(event.tab.id));
    });

    if (event.window.closing) {
      save_delay(state);
    } else {
      save(state);
    }
  }

  return state;
};

if (false) {
//var url_popup = @url.get("popup.html")

//@migrate.db["delete"]("current.windows.array")

var windows_id = {}; // Chrome Window ID -> Tab Organizer Window Id
var tabs_id    = {}; // Chrome Tab ID    -> Tab Organizer Tab Id

var db_windows = @migrate.db.get("tables.windows", {});
var db_tabs    = @migrate.db.get("tables.tabs", {});

var sorted_windows  = []; // [Tab Organizer Window]
var tabs_for_window = {}; // Tab Organizer Window Id -> [Tab Organizer Tab]

var table_windows = @Table({
  primary: "id",
  columns: {
    "id"           : @type(@isNumber),
    "index"        : @type(@isNumber),
    "name"         : @type(@isString),
    "time-created" : @type(@isNumber),
    "focused-tab"  : null, //@ref(-> tabs, { remove: @update }),
    //"next"         : null  //@ref(-> windows)
  }
});

var table_tabs = @Table({
  primary: "id",
  columns: {
    "id"                   : @type(@isNumber),
    "index"                : @type(@isNumber),
    "url"                  : @type(@isString),
    "title"                : @type(@isString),
    "favicon"              : @type(@isString),
    "pinned"               : @type(isPseudoBoolean),
    "active"               : @type(isPseudoBoolean),
    "time-created"         : @type(@isNumber),
    "time-updated"         : @type(@isNumber),
    "time-focused"         : @type(@isNumber),
    "time-unfocused"       : @type(@isNumber),
    "time-moved-in-window" : @type(@isNumber),
    "time-moved-to-window" : @type(@isNumber),
    "window"               : null, //@ref(-> windows, { remove: @remove }),
    //"next"                 : null  //@ref(-> tabs)
  }
});

/*spawn table_tabs ..@changes ..@each(function (change) {
  if (change.type === @insert) {

  } else if (change.type === @update) {

  } else if (change.type === @remove) {

  } else {
    @assert.fail();
  }
});*/


function save_windows() {
  @migrate.db.set("tables.windows", db_windows);
}

function save_tabs() {
  @migrate.db.set("tables.tabs", db_tabs);
}

// TODO this is specific to Chrome...?
// TODO test this again, to make sure it's working
// TODO code duplication with session
function save_delay() {
  // 10 seconds, so that when Chrome exits,
  // it doesn't clobber the user's data
  return @migrate.db.delay("current.windows.array", 10000, function () {
    return save()
  })
}


function tab_update(tab_old, tab_new) {
  @assert.ok(toBoolean(tab_old["active"]));
  //@assert.is(tab_old.active ..to_boolean("focused"), tab_new.focused)

  table_tabs ..@update(tab_old["id"], function () {
    return {
      "url":     tab_new.url,
      "favicon": tab_new.favicon,
      "title":   tab_new.title,
      "pinned":  toPseudoBoolean(tab_new.pinned)
    };
  });
}

function tab_reset_focus(tab_old, tab_new) {
  @assert.ok(tab_old.active == null)
  tab_old.active = {}
  tab_old.active ..set_boolean("focused", tab_new.focused)
}

function insert_window(id, info) {
  var window = table_windows ..@insert({
    "id": id,
    "time-created": @timestamp()
  });

  if (first_window == null) {
    first_window = id;
  }

  if (last_window != null) {
    db_windows ..@set(last_window, table_windows ..@update(last_window, -> { "next": id }));
  }

  prev_windows[id] = last_window;
  last_window = id;

  tabs_for_window ..@setNew(id, []);
  windows_id ..@setNew(info.id, id);
  db_windows ..@setNew(id, window);
  save_windows();

  // TODO is this correct ?
  /*window_new.tabs ..@each(function (tab_new) {
    var id = tab_new.id
    tab_open(id, window_new, tab_new)
  });*/

  return window;
}

function window_close(window_new) {
  // TODO
  var window_old = windows_id ..@get(window_new.id);

  var id = window_old["id"];

  windows_id ..@delete(window_new.id);

  table_windows ..@remove(id);

  var prev = prev_windows[id];
  var next = window_old["next"];

  if (prev != null) {
    table_windows ..@update(prev, function () {
      return {
        "next": next
      };
    });
  }
  if (next != null) {
    prev_windows[next] = prev;
  }
  if (first_window === id) {
    first_window = next;
  }
  if (last_window === id) {
    last_window = prev;
  }

  setTimeout(function () {
    db_windows ..@delete(id);
    save_windows();
  }, 10000);

  var index = windows_db ..@remove(window_old)

  // TODO is this necessary ?
  window_old.children ..@each(function (tab_old) {
    console.log("REMOVING UNLOADED CHILD #{tab_old.url}")
    tabs_id ..@delete(tab_old.id)
  })

  save_delay()

  @connection.send("tabs", {
    type: "window.close",
    index: index
  })

  return window_old
}

function tab_open(id, window_new, tab_new) {
  var window_old = windows_id ..@get(window_new.id)

  var tab = {
    id: id,
    time: {
      created: @timestamp()
    }
  }

  tab_reset_focus(tab, tab_new)
  tab_set(tab, tab_new)
  tabs_id ..@setNew(tab.id, tab)

  var index = index_from_tab(window_old, window_new, tab_new)
  window_old.children ..@spliceNew(index, tab)

  save()

  @connection.send("tabs", {
    type: "tab.open",
    window: window_old.id,
    index: index,
    tab: tab
  })

  return tab
}

function tab_close(tab_old, window_old, closing) {
  // TODO replace with isBoolean test
  @assert.ok(closing === true || closing === false)

  tabs_id ..@delete(tab_old.id)
  var index = window_old.children ..@remove(tab_old)

  if (closing) {
    save_delay()
  } else {
    save()
  }

  @connection.send("tabs", {
    type: "tab.close",
    window: window_old.id,
    index: index,
    tab: tab_old
  })

  return tab_old
}

// TODO this should call `should_update`
function tab_update(tab_old, tab_new) {
  tab_set(tab_old, tab_new)
  tab_old.time.updated = @timestamp()

  save()

  return tab_old
}

function index_from_tab(window_old, window_new, tab_new) {
  @assert.is(tab_new ..@has("index"), true) // TODO remove this and use @get instead

  if (tab_new.index === 0) {
    return 0
  } else {
    // Get the tab to the left
    var tabs = window_new.tabs
    var prev = tabs ..@get(tab_new.index - 1)
    var prev_old = tabs_id ..@get(prev.id)
    return (window_old.children ..@indexOf(prev_old)) + 1
  }
}

// TODO it should probably take into account the direction of movement (left or right)
function tab_move(event) {
  @assert.ok(event.before.window || event.after.window)
  @assert.is(event.before.tab.id, event.after.tab.id)

  var tab_old = tabs_id ..@get(event.after.tab.id)

  if (event.before.window) {
    var window_before = windows_id ..@get(event.before.window.id)
    window_before.children ..@remove(tab_old)
  }

  if (event.after.window) {
    var window_after = windows_id ..@get(event.after.window.id)
    var index        = index_from_tab(window_after, event.after.window, event.after.tab)
    window_after.children ..@spliceNew(index, tab_old)
  }

  if (event.after.window) {
    var moved = @timestamp()

    if (event.before.window && event.before.window.id === event.after.window.id) {
      tab_old.time.moved_in_window = moved
    } else {
      tab_old.time.moved_to_window = moved
    }
  }

  save()

  /*@connection.send("tabs", {
    type: "tab-moved",
    tab: tab_old,
    move_from: {
      window: window_old.id
    },
    move_to: {
      window: window_new.id,
      index: index
    }
  })*/

  return tab_old
}

function tab_focus(event) {
  @assert.ok(event.before || event.after)

  if (event.before) {
    var tab_before = tabs_id ..@get(event.before.tab.id)
    @assert.ok(tab_before.active != null)
    @assert.is(tab_before.active ..to_boolean("focused"), true)

    tab_before.active ..set_boolean("focused", false)
    tab_before.time.unfocused = @timestamp()
  }

  if (event.after) {
    var tab_after = tabs_id ..@get(event.after.tab.id)
    @assert.ok(tab_after.active != null)
    @assert.is(tab_after.active ..to_boolean("focused"), false)

    tab_after.active ..set_boolean("focused", true)
    tab_after.time.focused = @timestamp()
  }

  save()

  /*@connection.send("tabs", {
    type: "tab-focused",
    tab: tab_old
  })*/
}


// Load in saved tabs
windows_db ..@each(function (window_old) {
  windows_id ..@setNew(window_old.id, window_old)

  window_old.children ..@each(function (tab_old) {
    delete tab_old.active
    tabs_id ..@setNew(tab_old.id, tab_old)
  })
})

// Load in new tabs
@session.windows.getCurrent() ..@each(function (window_new) {
  var id = window_new.id

  if (windows_id ..@has(id)) {
    window_new.tabs ..@each(function (tab_new) {
      var id = tab_new.id

      if (tabs_id ..@has(id)) {
        var tab_old = tabs_id ..@get(id)

        tab_reset_focus(tab_old, tab_new)

        if (should_update(tab_old, tab_new)) {
          // TODO check that the relative position of the tab is correct?
          tab_update(tab_old, tab_new)
        }

      } else {
        tab_open(id, window_new, tab_new)
      }
    })

  } else {
    window_open(id, window_new)
  }
})

// Migrate old window titles to the new system
// TODO hacky that this is in here, rather than in migrate.sjs
// TODO test this
if (@migrate.db.has("window.titles")) {
  @zip(@session.windows.getCurrent(), @migrate.db.get("window.titles")) ..@each(function ([window, title]) {
    var window_new = windows_id ..@get(window.id)
    window_new.name = title
    save()
  })

  // TODO
  @migrate.db["delete"]("window.titles")
}

// This probably isn't necessary, but I like it just in case
save()

console.info("tabs: saved windows", windows_db)


exports.windows = {}
exports.windows.getCurrent = function () {
  return windows_db
}

exports.tabs = {}
exports.tabs.events = @Emitter()

spawn @session.tabs.events ..@each(function (event) {
  if (event.type === "windows.open") {
    window_open(event.window.id, event.window)

  } else if (event.type === "windows.close") {
    window_close(event.window)

  } else if (event.type === "tabs.open") {
    var id = event.tab.id

    exports.tabs.events ..@emit({
      type: "tabs.open",
      tab: tab_open(id, event.window, event.tab)
    })

  } else if (event.type === "tabs.update") {
    // TODO remove this later ?
    var window = windows_id ..@get(event.window.id)
    @assert.is(window.id, event.window.id)

    var tab_new = event.tab
    var tab_old = tabs_id ..@get(tab_new.id)

    if (should_update(tab_old, tab_new)) {
      tab_update(tab_old, tab_new)

      @connection.send("tabs", {
        type: "tab.update",
        window: event.window.id,
        tab: tab_old
      })
    }

  //} else if (event.type === "tabs.replace") {
  //  console.log(event.type)
  } else if (event.type === "tabs.focus") {
    tab_focus(event)

  } else if (event.type === "tabs.move") {
    tab_move(event)

  } else if (event.type === "tabs.close") {
    var tab = tabs_id ..@get(event.tab.id)
    var window = windows_id ..@get(event.window.id)
    var closing = event.window.closing

    exports.tabs.events ..@emit({
      type: "tabs.close",
      tab: tab_close(tab, window, closing)
    })

  } else {
    @assert.fail()
  }
})


@connection.on.connect("tabs", function () {
  return {
    windows: windows_db
  }
})
}
