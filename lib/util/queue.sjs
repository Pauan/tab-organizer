@ = require([
  { id: "sjs:assert", name: "assert" }
]);

exports.closed = {};

exports.drop = function (limit) {
  return function (state, x) {
    if (state.queue.length === limit) {
      state.queue.pop();
    }
    state.queue.push(x);
  };
};

exports.slide = function (limit) {
  return function (state, x) {
    if (state.queue.length === limit) {
      state.queue.shift();
    }
    state.queue.push(x);
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

exports.Queue = function (opts) {
  if (opts == null) {
    opts = {};
  }

  var state = {
    listeners: [],
    queue:     [],
    closed:    false
  };

  function pull() {
    if (state.queue.length) {
      hold(0); // TODO is this a good idea ?
      return state.queue.shift();

    } else if (state.closed) {
      hold(0); // TODO is this a good idea ?
      return exports.closed;

    } else {
      waitfor (var value) {
        state.listeners.push(resume);
      } retract {
        // TODO library function for this
        var index = state.listeners.indexOf(resume);
        @assert.ok(index !== -1);
        state.listeners.splice(index, 1);
      }
      return value;
    }
  }

  function push(x) {
    if (state.closed) {
      return false;

    } else {
      if (state.listeners.length) {
        var f = state.listeners.shift();
        f(x);

      } else {
        if (opts.buffer != null) {
          opts.buffer(state, x);
        } else {
          state.queue.push(x);
        }
      }

      return true;
    }
  }

  function close() {
    if (!state.closed) {
      state.listeners.forEach(function (f) {
        f(exports.closed);
      });

      state.listeners = [];
      state.closed = true;
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
