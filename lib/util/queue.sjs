@ = require([
  { id: "sjs:assert", name: "assert" }
]);

exports.Queue = function (opts) {
  // TODO is this __js correct ?
  __js {
    if (opts == null) {
      opts = {};
    }

    var listeners = [];
    var queue     = [];
    var closed    = false;

    function push(x) {
      if (closed) {
        return false;

      } else {
        if (listeners.length) {
          var f = listeners.shift();
          f(x);

        } else {
          if (opts.buffer != null) {
            opts.buffer(queue, x);
          } else {
            queue.push(x);
          }
        }

        return true;
      }
    }

    function close() {
      if (!closed) {
        listeners.forEach(function (f) {
          f(exports.closed);
        });

        listeners = [];
        closed = true;
      }
    }
  }

  function pull() {
    if (queue.length) {
      hold(0); // TODO is this a good idea ?
      return queue.shift();

    } else if (closed) {
      hold(0); // TODO is this a good idea ?
      return exports.closed;

    } else {
      waitfor (var value) {
        listeners.push(resume);
      } retract {
        // TODO library function for this
        var index = listeners.indexOf(resume);
        @assert.ok(index !== -1);
        listeners.splice(index, 1);
      }
      return value;
    }
  }

  return {
    pull: pull,
    push: push,
    close: close
  };
};

exports.foldq = function (pull, init, fn) {
  for (;;) {
    var value = pull();
    if (value === exports.closed) {
      return init;
    } else {
      init = fn(init, value);
    }
  }
};

// TODO support transducers ?
/*exports.pipe = function (pull, push) {
  for (;;) {
    var value = pull();
    if (value === exports.closed) {
      break;
    } else if (!push(value)) {
      break;
    }
  }
};*/

__js {
  exports.closed = {};

  exports.drop = function (limit) {
    return function (queue, x) {
      if (queue.length === limit) {
        queue.pop();
      }
      queue.push(x);
    };
  };

  exports.slide = function (limit) {
    return function (queue, x) {
      if (queue.length === limit) {
        queue.shift();
      }
      queue.push(x);
    };
  };

  /*exports.dedupe = function (queue, x) {
    if (queue.length) {
      // TODO library function for this
      var last = queue[queue.length - 1];
      // TODO use value equality ?
      if (last !== x) {
        queue.push(x);
      }
    } else {
      queue.push(x);
    }
  };*/

  exports.Publisher = function () {
    var subscribed = [];

    function subscribe(push) {
      subscribed.push(push);
    }

    function unsubscribe(push) {
      // TODO utility for this
      var index = subscribed.indexOf(push);
      @assert.isNot(index, -1);
      subscribed.splice(index, 1);
    }

    function publish(x) {
      // TODO super hacky, needed to make error messages work correctly
      //hold(0);

      var toRemove = [];

      subscribed.forEach(function (f) {
        // TODO assert that `f` doesn't suspend ?
        if (!f(x)) {
          toRemove.push(f);
        }
      });

      toRemove.forEach(function (x) {
        unsubscribe(x);
      });
    }

    return {
      subscribe: subscribe,
      unsubscribe: unsubscribe,
      publish: publish
    };
  };
}
