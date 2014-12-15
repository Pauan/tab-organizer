@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" },
  { id: "sjs:object" },
  { id: "lib:util/util" },
  { id: "lib:util/event" },
  { id: "lib:extension/server" },
  { id: "./migrate", name: "migrate" },
  { id: "./session", name: "session" }
]);


function isPseudoBoolean(x) {
  return x === 1 || x === void 0;
}

function toBoolean(value) {
  if (value === void 0) {
    return false;
  } else if (value === 1) {
    return true;
  } else {
    @assert.fail();
  }
}

function toPseudoBoolean(value) {
  @assert.ok(@isBoolean(value));
  if (value) {
    return 1;
  } else {
    return void 0;
  }
}


exports.init = function (push) {
  var windows = @session.init(push);

  var db_windows = @migrate.db.get("current.windows.array", @List());

  console.log(windows, db_windows);

  return db_windows;
};


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


console.info("tabs: finished")
