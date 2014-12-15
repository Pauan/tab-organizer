// TODO get rid of wait if it's not needed anymore

/*
var queue = {}

if (!(name in queue)) {
  queue[name] = spawn ...
}

queue[name].value()
*/


@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:object" },
  { id: "sjs:sequence" },
  { id: "lib:util/util" },
  { id: "lib:extension/server" }
])


var version = 1414145108930;


/*var tables = {};

table_info ..@eachKeys(function (name, info) {
  var o = @db.get(name, null);

  if (o === null) {
    o = {
      version: info.version,
      data: {}
    };
    @db.set(name, o);

  } else if (o.version !== info.version) {
    info.migrate(o.data, o.version);
    o.version = info.version;
    @db.set(name, o);
  }

  var table = @Table({
    primary: info.primary,
    columns: info.columns
  });

  o.data ..@eachKeys(function (_, record) {
    table ..@insert(record);
  });

  spawn @changes(table) ..@each(function (change) {
    o.data = table ..@toObject;
    @db.set(name, o);
  });

  tables ..@setNew(name, table);
});

exports.Table = function (name) {
  return tables ..@get(name);
};*/

// TODO utility for this ?
function moveValue(obj, key, from, to) {
  if (obj ..@has(key)) {
    if (obj ..@get(key) === from) {
      obj ..@set(key, to)
    }
  }
}

// TODO utility for this
function move(obj, from, to) {
  if (obj ..@has(from)) {
    var value = obj ..@get(from)
    obj ..@setNew(to, value)
    obj ..@delete(from)
  }
}

/*
// TODO make this work for all sequences
// TODO move into lib:util/util ?
function eachNext(array, f) {
  for (var i = 0, len = array.length; i < len; ++i) {
    f(array[i], array[i + 1]);
  }
}*/


var migrators = {};

migrators["string"] = function (obj) {
  ;(function () {
    var opts = obj["options.user"];
    if (opts != null) {
      // TODO utility for these ?
      delete opts["tab.sort.type"]
      delete opts["tab.show.in-chrome"]
      delete opts["groups.move-with-window"]

      delete opts["popup.hotkey.ctrl"]
      delete opts["popup.hotkey.shift"]
      delete opts["popup.hotkey.alt"]
      delete opts["popup.hotkey.letter"]

      // TODO test this
      if (opts ..@has("counter.type")) {
        var counter_type = opts ..@get("counter.type")
        // TODO this isn't quite correct: it should reset to the default
        if (counter_type === "total") {
          delete opts["counter.display.loaded"]
          delete opts["counter.display.unloaded"]

        } else if (counter_type === "in-chrome") {
          delete opts["counter.display.loaded"]
          opts["counter.display.unloaded"] = false

        } else {
          @assert.fail()
        }
        opts ..@delete("counter.type")
      }

      opts ..moveValue("group.sort.type", "window", "group")
      opts ..moveValue("group.sort.type", "domain", "url")
      opts ..moveValue("group.sort.type", "loaded", "created")
      //opts ..moveValue("tab.sort.type",   "loaded", "created")
      opts ..move("size.sidebar.direction", "size.sidebar.position")

      obj ..@setNew("options", opts);
      obj ..@delete("options.user");
    }
  })();

  ;(function () {
    var cache = obj["options.cache"];
    if (cache != null) {
      cache ..move("global.scroll", "popup.scroll")

      if (cache ..@has("screen.available-size")) {
        var oSize = cache ..@get("screen.available-size")

        // TODO utility for these ?
        cache["screen.available.checked"] = true
        cache["screen.available.left"]    = oSize ..@get("left")
        cache["screen.available.top"]     = oSize ..@get("top")
        cache["screen.available.width"]   = oSize ..@get("width")
        cache["screen.available.height"]  = oSize ..@get("height")

        cache ..@delete("screen.available-size");
      }

      obj ..@setNew("cache", cache);
      obj ..@delete("options.cache");
    }
  })();

  ;(function () {
    function set(o, tab, s) {
      if (tab.time[s] != null) {
        o.time[s] = tab.time[s];
      }
    }

    function convertTab(tab) {
      @assert.ok(tab.groups != null, tab.title)

      var o    = {}
      o.time   = {}
      o.groups = tab.groups
      o.title  = tab.title

      set(o, tab, "created")
      set(o, tab, "updated")
      set(o, tab, "focused")
      set(o, tab, "unloaded")
      set(o, tab, "session")
      return o
    }

    var tabs = obj["current.tabs"];
    if (tabs != null) {
      var windows_db = obj["current.windows.array"] || [];

      var groups = {}

      function addToGroup(name, time, tab, url) {
        if (time === 1 || time === null) {
          time = @timestamp()
        }

        var group = groups ..@get_or_set(name, function () {
          var o = {
            id: @timestamp(),
            time: {
              created: time
            },
            children: []
          }

          if (name !== "") {
            o.name = name
          }

          windows_db.push(o)
          return o
        })

        group.time.created = Math.min(group.time.created, time)

        group.children.push({
          id: @timestamp(),
          url: url,
          favicon: "chrome://favicon/#{url}", // TODO hacky and code duplication with lib:extension
          time: tab.time,
          title: tab.title
        })

        obj["current.windows.array"] = windows_db;
      }


      tabs ..@items ..@each(function ([url, tab]) {
        if (tab.url != null && url !== tab.url) {
          url = tab.url
        }

        tab = convertTab(tab)

        var seen = false

        tab.groups ..@items ..@each(function ([key, value]) {
          seen = true

          addToGroup(key, value, tab, url)
        })

        if (!seen) {
          addToGroup("", null, tab, url)
        }
      })

      obj ..@delete("current.tabs");
    }
  })();

  ;(function () {
    var windows = obj["__extension.chrome.tabs.windows__"];
    if (windows != null) {
      obj ..@setNew("session.windows.array", windows);
      obj ..@delete("__extension.chrome.tabs.windows__");
    }
  })();

  ;(function () {
    var timestamps = {};

    function unique(time) {
      while (timestamps[time]) {
        ++time;
      }
      timestamps[time] = true;
      return time;
    }

    var windows = obj["current.windows.array"];
    if (windows != null) {
      windows ..@each(function (window) {
        window ..@setNew("tabs", window ..@get("children"));
        window.time ..@set("created", unique(window.time ..@get("created")));

        window.tabs ..@each(function (tab) {
          if (tab.time == null) {
            tab.time = {
              created: @timestamp()
            };
          }

          tab.time ..@set("created", unique(tab.time ..@get("created")));

          if (tab.time.updated != null) {
            tab.time.updated = unique(tab.time.updated);
          }
          if (tab.time.focused != null) {
            tab.time.focused = unique(tab.time.focused);
          }
          if (tab.time.unfocused != null) {
            tab.time.unfocused = unique(tab.time.unfocused);
          }
          if (tab.time.moved_in_window != null) {
            tab.time.moved_in_window = unique(tab.time.moved_in_window);
          }
          if (tab.time.moved_to_window != null) {
            tab.time.moved_to_window = unique(tab.time.moved_to_window);
          }

          delete tab.time.moved;
        });
      });

/*
      var table_windows = {};
      var table_tabs    = {};

      windows ..@rebalanceIndexes(function (x, i) {
        x.index = i;
        return x;
      }) ..@each(function (win) {
        var o = {};
        table_windows ..@setNew(win.id, o);

        o["id"] = win.id;

        if (win.name != null) {
          o["name"] = win.name;
        }

        if (win.time.created != null) {
          o["time-created"] = unique(win.time.created);
        }

        o["index"] = win.index;

        win.children ..@rebalanceIndexes(function (x, i) {
          x.index = i;
          return x;
        }) ..@each(function (tab) {
          var o = {};
          table_tabs ..@setNew(tab.id, o);

          o["id"] = tab.id;

          if (tab.url != null) {
            o["url"] = tab.url;
          }

          if (tab.title != null) {
            o["title"] = tab.title;
          }

          if (tab.favicon != null) {
            o["favicon"] = tab.favicon;
          }

          if (tab.pinned) {
            o["pinned"] = 1;
          }

          o["index"] = tab.index;

          if (tab.time.created != null) {
            o["time-created"] = unique(tab.time.created);
          }
          if (tab.time.updated != null) {
            o["time-updated"] = unique(tab.time.updated);
          }
          if (tab.time.focused != null) {
            o["time-focused"] = unique(tab.time.focused);
          }
          if (tab.time.unfocused != null) {
            o["time-unfocused"] = unique(tab.time.unfocused);
          }
          if (tab.time.moved_in_window != null) {
            o["time-moved-in-window"] = unique(tab.time.moved_in_window);
          }
          if (tab.time.moved_to_window != null) {
            o["time-moved-to-window"] = unique(tab.time.moved_to_window);
          }

          o["window"] = win.id;
        });
      });

      obj ..@setNew("tables.windows", table_windows);
      obj ..@setNew("tables.tabs", table_tabs);
      obj ..@delete("current.windows.array");*/
    }
  })();

  delete obj["current.groups"];
  delete obj["current.tabs.ids"];

  //obj.version = 1414145045915;
};


exports.db = @db

exports.shouldMigrate = function (obj) {
  return obj.version !== version;
};

exports.migrate = function (obj) {
  @assert.ok(exports.shouldMigrate(obj));
  //@db["delete"]("version")

  delete localStorage["migrated"];

  var old_version = obj.version;
  if (old_version != null) {
    if (typeof old_version === "string") {
      migrators["string"](obj);
    }
  }

  obj.version = version;

  return obj;
}

var data = @db.getAll();
if (exports.shouldMigrate(data)) {
  @db.setAll(exports.migrate(data));
  console.info("migrate: migrated to version #{version}");
}


/*
// TODO it's hacky that this is here
@connection.on.command("db.export", function () {
  return @db.getAll();
});*/

console.info("migrate: finished");
