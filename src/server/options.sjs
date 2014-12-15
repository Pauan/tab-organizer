@ = require([
  { id: "sjs:object" },
  { id: "sjs:sequence" },
  { id: "lib:util/util" },
  { id: "lib:util/event" },
  { id: "lib:extension/server" },
  { id: "./migrate", name: "migrate" }
])


function make(db_name, defs) {
  var opts     = {};
  var emitters = {};

  var db_opt = @migrate.db.get(db_name, {});

  function create([name, value]) {
    if (!(opts ..@has(key))) {
      opts ..@setNew(key, value);
      emitters ..@setNew(key, @Emitter());
    }
  }

  function get(name) {
    return opts ..@get(name);
  }

  function getDefault(name) {
    return defs ..@get(name);
  }

  function set(name, value) {
    var old = get(name);
    if (value !== old) {
      var def = getDefault(name);

      if (value === def) {
        db_opt ..@delete(name);
      } else {
        // name may or may not exist in db_opt
        db_opt[name] = value;
      }

      @migrate.db.set(db_name, db_opt);

      emitters ..@get(name) ..@emit(value);

      @connection.send(db_name, {
        type: "update",
        name: name,
        value: value
      });
    }
  }

  function ref(name) {
    return @Stream(function (emit) {
      emit(get(name));
      emitters ..@get(name) ..@each(emit); // TODO use @listen here ?
    });
  }

  db_opt ..@items ..@each(create); // This has to go before defs
  defs   ..@items ..@each(create);

  @connection.on.connect(db_name, function () {
    return {
      data: opts,
      defaults: defs
    };
  });

  spawn @connection.on.message(db_name) ..@listen(function (message) {
    var type = message ..@get("type");

    if (type === "update") {
      var name  = message ..@get("name");
      var value = message ..@get("value");
      set(name, value);

    } else if (type === "reset") {
      defs ..@items ..@each(function ([name, value]) {
        set(name, value);
      });

    } else {
      @assert.fail();
    }
  });

  return { get, set, ref };
}


exports.opt = make("options", {
  "counter.enabled"           : true,
  "counter.display.loaded"    : true,
  "counter.display.unloaded"  : true,

  "size.sidebar"              : 300,
  "size.sidebar.position"     : "left",

  "size.popup.left"           : 0.5,
  "size.popup.top"            : 0.5,
  "size.popup.width"          : 920,
  "size.popup.height"         : 496,

  "size.bubble.width"         : 300,
  "size.bubble.height"        : 600,

  "size.panel.width"          : 300,
  "size.panel.height"         : 600,

  "popup.type"                : "bubble",

  "popup.close.escape"        : false,
  "popup.switch.action"       : "minimize",
  "popup.close.when"          : "switch-tab", // "manual",

  "group.sort.type"           : "group",
  "groups.layout"             : "vertical",
  "groups.layout.grid.column" : 3,
  "groups.layout.grid.row"    : 2,

  "tabs.close.location"       : "right",
  "tabs.close.display"        : "hover",
  "tabs.close.duplicates"     : false,
  "tabs.click.type"           : "focus",

  "theme.animation"           : true,
  "theme.color"               : "blue",

  "usage-tracking"            : true
});


exports.cache = make("cache", {
  "popup.scroll"             : 0,
  "search.last"              : "",

  "counter.session"          : null,

  "screen.available.checked" : false,
  "screen.available.left"    : 0,
  "screen.available.top"     : 0,
  "screen.available.width"   : screen ..@get("width"), // TODO ew
  "screen.available.height"  : screen ..@get("height") // TODO ew
});


console.info("options: finished");
