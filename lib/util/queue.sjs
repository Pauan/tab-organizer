@ = require([
  { id: "sjs:assert", name: "assert" }
]);

exports.closed = {};

exports.drop = function (limit) {
  return function (queue) {
    if (queue.length > limit) {
      queue.pop();
    }
  };
};

exports.slide = function (limit) {
  return function (queue) {
    if (queue.length > limit) {
      queue.shift();
    }
  };
};

exports.Queue = function (fn) {
  var listeners = [];
  var queue     = [];
  var closed    = false;

  return {
    pull: function () {
      if (queue.length) {
        hold(0); // TODO is this a good idea ?
        return queue.shift();

      } else if (closed) {
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
    },

    push: function (type, value) {
      if (closed) {
        return false;

      } else {
        var x = { type, value };

        if (listeners.length) {
          var f = listeners.shift();
          f(x);

        } else {
          queue.push(x);

          if (fn != null) {
            fn(queue);
          }
        }

        return true;
      }
    },

    close: function () {
      closed = true;

      listeners.forEach(function (f) {
        f(exports.closed);
      });

      listeners = [];
    }
  }
};

exports.foldq = function (init, pull, fn) {
  for (;;) {
    var value = pull();
    if (value === exports.closed) {
      break;
    } else {
      init = fn(init, value);
    }
  }
};

// TODO support transducers ?
exports.pipe = function (pull, push) {
  for (;;) {
    var value = pull();
    if (value === exports.closed) {
      break;
    } else if (!push(value)) {
      break;
    }
  }
};
