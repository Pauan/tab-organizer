@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:collection/immutable" },
  { id: "sjs:type" },
  { id: "sjs:sequence" },
  { id: "lib:extension/server" }
]);


// TODO test this
function fromJS(x) {
  if (@isSequence(x)) {
    return @List(x ..@transform(fromJS));

  } else if (@isObject(x)) {
    return @Dict(x ..@ownPropertyPairs ..@transform(function ([key, value]) {
      return [key, fromJS(value)];
    }));

  } else {
    return x;
  }
}


var js_db = @storage.get();

var db = fromJS(js_db);

@assert.ok(@isDict(db));

console.info("db:", db);


// TODO what about delay, how should that interact with wait ?
/*exports.wait = function (f) {
  var x = f()

  var keys = timer ..@ownKeys
  var i    = keys ..@count

  if (i === 0) {
    throw new Error("db/wait: no pending operations")
  } else {
    console.info("db/wait: waiting for { #{keys.join(" ")} }")
  }

  waitfor () {
    waiting = function () {
      if (--i === 0) {
        console.info("db/wait: finished")
        resume()
      }
    }
  } retract {
    console.info("db/wait: retracted")
  } finally {
    waiting = null
  }

  return x
}*/


/*exports.delay = function (name, ms, f) {
  // TODO object/has
  // This is so it won't keep resetting it over and over again
  if (name in delay) {
    @assert.is(delay[name], ms)

  } else {
    // Set the delay
    delay[name] = ms

    // TODO object/has
    // Restart the timer, if it exists
    if (name in timer) {
      timer[name]()
    }
  }

  var result = f()
  // TODO object/has
  @assert.ok(name in timer)
  return result
};*/


exports.get = function () {
  return db;
};


var setting = false;

exports.set = function (o) {
  @assert.ok(@isDict(o));

  db = o;

  if (!setting) {
    setting = true;

    spawn (function () {
      hold(1000);
      setting = false;

      var new_js_db = @toJS(db);

      var toRemove = [];
      for (var s in js_db) {
        if (!(s in new_js_db)) {
          toRemove.push(s);
        }
      }

      console.log(toRemove, new_js_db);

      js_db = new_js_db;

      waitfor {
        if (toRemove.length) {
          // TODO what if a different stratum sets things before this is done clearing?
          @storage.remove(toRemove);
        }
      } and {
        @storage.set(js_db);
      }

      console.debug("db/set: " + Object.keys());
    })();
  }
};
