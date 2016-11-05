"use strict";


function Mutable(events, value) {
  this.snapshot = {
    id: 0,
    value: value
  };

  this.listeners = events;
}


exports.makeImpl = function (Events) {
  return function (value) {
    return function () {
      return new Mutable(Events(), value);
    };
  };
};


exports.viewImpl = function (receive) {
  return function (unit) {
    return function (mutable) {
      return {
        snapshot: function () {
          return mutable.snapshot;
        },
        subscribe: function (push) {
          // TODO make this faster ?
          return receive(function (id) {
            return function () {
              push(id);
              return unit;
            };
          })(mutable.listeners)();
        }
      };
    };
  };
};


exports.get = function (mutable) {
  return function (state) {
    return mutable.snapshot.value;
  };
};


// TODO test this
exports.setImpl = function (send) {
  return function (unit) {
    return function (newValue) {
      return function (mutable) {
        return function (state) {
          var oldSnapshot = mutable.snapshot;

          // Optimization for speed: if the value hasn't changed, then there's no reason to push
          if (oldSnapshot.value !== newValue) {
            // TODO do this per `Mutable` rather than per `set`
            state.push({
              rollback: function () {
                mutable.snapshot = oldSnapshot;
              },
              commit: function (id) {
                return send(id)(mutable.listeners)();
              }
            });

            mutable.snapshot = {
              // TODO is this correct ?
              id: oldSnapshot.id + 1,
              value: newValue
            };
          }

          return unit;
        };
      };
    };
  };
};
