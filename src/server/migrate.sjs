@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:collection/immutable" },
  { id: "sjs:sequence" },
  { id: "lib:util/util" }
])


var version = 1418658357584;


// TODO utility for this ?
function moveValue(obj, key, from, to) {
  if (obj.has(key) && obj.get(key) === from) {
    return obj.set(key, to);
  } else {
    return obj;
  }
}

// TODO utility for this
function move(obj, from, to) {
  if (obj.has(from)) {
    var value = obj.get(from);
    return obj.remove(from).set(to, value);
  } else {
    return obj;
  }
}

function modifyNull(obj, key, f) {
  if (obj.get(key, null) != null) {
    return obj.modify(key, f);
  } else {
    return obj;
  }
}

function withKeyModify(obj, key, f) {
  if (obj.has(key)) {
    return obj.modify(key, f);
  } else {
    return obj;
  }
}

function withKey(obj, key, f) {
  if (obj.has(key)) {
    f(obj.get(key));
  }
}


var migrators = [];

migrators.push(function (db, version) {
  if (version < 1414145108930) {
    withKey(db, "options.user", function (opts) {
      opts = opts.remove("tab.sort.type");
      opts = opts.remove("tab.show.in-chrome");
      opts = opts.remove("groups.move-with-window");

      opts = opts.remove("popup.hotkey.ctrl");
      opts = opts.remove("popup.hotkey.shift");
      opts = opts.remove("popup.hotkey.alt");
      opts = opts.remove("popup.hotkey.letter");

      withKey(opts, "counter.type", function (counter_type) {
        // TODO this isn't quite correct: it should reset to the default
        if (counter_type === "total") {
          opts = opts.remove("counter.display.loaded");
          opts = opts.remove("counter.display.unloaded");

        } else if (counter_type === "in-chrome") {
          opts = opts.remove("counter.display.loaded");
          opts = opts.set("counter.display.unloaded", false);

        } else {
          @assert.fail()
        }

        opts = opts.remove("counter.type");
      });

      opts = opts ..moveValue("group.sort.type", "window", "group")
      opts = opts ..moveValue("group.sort.type", "domain", "url")
      opts = opts ..moveValue("group.sort.type", "loaded", "created")
      //opts = opts ..moveValue("tab.sort.type",   "loaded", "created")
      opts = opts ..move("size.sidebar.direction", "size.sidebar.position")

      db = db.remove("options.user");
      db = db.set("options", opts);
    });

    withKey(db, "options.cache", function (cache) {
      cache = cache ..move("global.scroll", "popup.scroll");

      withKey(cache, "screen.available-size", function (oSize) {
        cache = cache.set("screen.available.checked", true);
        cache = cache.set("screen.available.left",    oSize.get("left"));
        cache = cache.set("screen.available.top",     oSize.get("top"));
        cache = cache.set("screen.available.width",   oSize.get("width"));
        cache = cache.set("screen.available.height",  oSize.get("height"));

        cache = cache.remove("screen.available-size");
      });

      db = db.remove("options.cache");
      db = db.set("cache", cache);
    });

    withKey(db, "current.tabs", function (tabs) {
      function set(to, from, s) {
        var value = from.get(s, null);
        if (value != null) {
          return to.set(s, value);
        } else {
          return to;
        }
      }

      function convertTab(tab, url) {
        @assert.ok(tab.has("groups"));

        var time = @Dict();
        var from = tab.get("time");

        time = set(time, from, "created");
        time = set(time, from, "updated");
        time = set(time, from, "focused");
        time = set(time, from, "unloaded");
        time = set(time, from, "session");

        return @Dict({
          "groups":  tab.get("groups"),
          "time":    time,
          "title":   tab.get("title"),
          "url":     url,
          "favicon": "chrome://favicon/#{url}", // TODO hacky and code duplication with lib:extension
        });
      }

      var groups = @List();

      function addToGroup(groups, name, time_created, tab) {
        if (time_created === 1 || time_created === null) {
          time_created = @timestamp()
        }

        tab = @Dict({
          "id":      @timestamp(),
          "time":    tab.get("time"),
          "title":   tab.get("title"),
          "url":     tab.get("url"),
          "favicon": tab.get("favicon")
        });

        // TODO O(n) -> O(1)
        var index = groups ..@findIndex(function (group) {
          return group.get("name", null) === name;
        }, null);

        if (index === null) {
          var group = @Dict({
            "id": @timestamp(),
            "time": @Dict({
              "created": time_created
            }),
            "children": @List([tab])
          });

          if (name !== "") {
            group = group.set("name", name);
          }

          return groups.insert(group);

        } else {
          return groups.modify(index, function (group) {
            return group.modify("time", function (time) {
              return time.modify("created", function (created) {
                return Math.min(created, time_created);
              });
            }).modify("children", function (children) {
              return children.insert(tab);
            });
          });
        }
      }

      tabs ..@each(function ([url, tab]) {
        var tab_url = tab.get("url", null);
        if (tab_url != null && url !== tab_url) {
          url = tab_url;
        }

        tab = convertTab(tab, url);

        var group = tab.get("groups");
        if (group.isEmpty()) {
          groups = addToGroup(groups, "", null, tab);

        } else {
          group ..@each(function ([key, value]) {
            groups = addToGroup(groups, key, value, tab);
          });
        }
      });

      var windows_db = db.get("current.windows.array", @List());
      db = db.remove("current.tabs");
      db = db.set("current.windows.array", windows_db.concat(groups));
    });

    db = db ..move("__extension.chrome.tabs.windows__", "session.windows.array");

    db = withKeyModify(db, "current.windows.array", function (windows) {
      var timestamps = {};

      function unique(time) {
        while (timestamps[time]) {
          ++time;
        }
        timestamps[time] = true;
        return time;
      }

      return @List(windows ..@transform(function (window) {
        window = window.modify("time", function (time) {
          return time.modify("created", unique);
        });

        window = window.modify("tabs", function (tabs) {
          return @List(tabs ..@transform(function (tab) {
            var time = tab.get("time", null);

            if (time == null) {
              time = @Dict({
                "created": @timestamp()
              });
            }

            time = time.modify("created", unique);
            time = time ..modifyNull("updated", unique);
            time = time ..modifyNull("focused", unique);
            time = time ..modifyNull("unfocused", unique);
            time = time ..modifyNull("moved_in_window", unique);
            time = time ..modifyNull("moved_to_window", unique);
            time = time.remove("moved");

            return tab.set("time", time);
          }));
        });

        return window;
      }));
    });

    db = db.remove("current.groups");
    db = db.remove("current.tabs.ids");
  }
  return db;
});


migrators.push(function (db, version) {
  if (version < 1418658357584) {
    db = withKeyModify(db, "current.windows.array", function (windows) {
      return @List(windows ..@transform(function (window) {
        window = window ..move("children", "tabs");

        return window.modify("tabs", function (tabs) {
          return @List(tabs ..@transform(function (tab) {
            return tab.modify("time", function (time) {
              time = time ..move("moved_in_window", "moved-in-window");
              time = time ..move("moved_to_window", "moved-to-window");
              return time;
            });
          }));
        });
      }));
    });
  }
  return db;
});


exports.migrate = function (old_db) {
  var start_time = Date.now();

  var new_db = old_db;

  var old_version = new_db.get("version", null);
  if (old_version != null && old_version !== version) {
    if (typeof old_version !== "number") {
      old_version = 0;
    }

    new_db = migrators ..@reduce(new_db, function (db, f) {
      return f(db, old_version);
    });
  }

  new_db = new_db.set("version", version);

  if (old_db !== new_db) {
    var end_time = Date.now();

    //console.log("migrate: old db", @toJS(old_db));
    //console.log("migrate: new db", @toJS(new_db));

    console.info("migrate: migrated to version #{version}, took #{end_time - start_time}ms");
  } else {
    console.info("migrate: already at version #{version}");
  }

  delete localStorage["migrated"];

  return new_db;
};

/*
// TODO it's hacky that this is here
@connection.on.command("db.export", function () {
  return @db.getAll();
});*/
