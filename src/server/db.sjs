@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:collection/immutable" },
  { id: "sjs:sequence" },
  { id: "sjs:type" },
  { id: "lib:extension/server" },
  { id: "./migrate" }
]);


__js {
  function fromJS(x) {
    if (@isArray(x)) {
      var y = @List();

      for (var i = 0, l = x.length; i < l; ++i) {
        y = y.insert(fromJS(x[i]));
      }

      return y;

    } else if (@isObject(x)) {
      var y = @Dict();

      for (var s in x) {
        y = y.set(s, fromJS(x[s]));
      }

      return y;

    } else {
      return x;
    }
  }
}


var delay = {};
var timer = {};

exports.delay = function (name, ms) {
  // TODO object/has
  // This is so it won't keep resetting it over and over again
  if (name in delay) {
    @assert.is(delay[name], ms)

  } else {
    // Set the delay
    delay[name] = ms;

    // TODO object/has
    // Restart the timer, if it exists
    if (name in timer) {
      timer[name]();
    }
  }
};

exports.has = function (s) {
  return db.has(s);
};

exports.get = function (s, def) {
  return db.get(s, def);
};

exports.set = function (s, o) {
  var new_db = db.set(s, o);
  if (new_db !== db) {
    db = new_db;

    if (!(s in timer)) {
      var timeout = null;

      timer[s] = function () {
        clearTimeout(timeout);

        timeout = setTimeout(function () {
          delete timer[s];
          delete delay[s];

          var set = {};

          var start_tojs = Date.now();

          set[s] = @toJS(db.get(s));

          var end_tojs = Date.now();

          var start_time = Date.now();

          @storage.set(set);

          var end_time = Date.now();

          console.debug("db/set: \"#{s}\" conversion took #{end_tojs - start_tojs}ms, assignment took #{end_time - start_time}ms");
        }, delay[s] || 1000);
      };

      timer[s]();
    }
  }

  return o;
};

exports.remove = function (s) {
  var new_db = db.remove(s);
  if (new_db !== db) {
    db = new_db;

    // TODO use a timer for this too ?
    spawn (function () {
      // TODO what if another strata sets things before this is done ?
      @storage.remove(s);
      console.debug("db/remove: " + s);
    })();
  }
};

function setAll(o) {
  if (o !== db) {
    var toRemove = [];

    db ..@each(function ([key, value]) {
      if (!o.has(key)) {
        toRemove.push(key);
      }
    });

    db = o;

    var start_tojs = Date.now();

    var set = @toJS(db);

    var end_tojs = Date.now();

    var start_time = Date.now();

    waitfor {
      if (toRemove.length) {
        // TODO what if a different stratum sets things before this is done clearing?
        @storage.remove(toRemove);
        console.debug("db/remove: " + toRemove.join(", "));
      }
    } and {
      @storage.set(set);
    }

    var end_time = Date.now();

    console.debug("db/setAll: conversion took #{end_tojs - start_tojs}ms, assignment took #{end_time - start_time}ms");
  }
}


var start_time = Date.now();

var db = fromJS(@storage.get());

/*for (var s in db) {
  db[s] = fromJS(db[s]);
}*/

var end_time = Date.now();

console.info("db: initialized, took #{end_time - start_time}ms");

setAll(@migrate(db));

window.showDB = function () {
  console.log(@toJS(db));
};
