@ = require([
  { id: "sjs:assert", name: "assert" }
]);

__js {
  exports.Publisher = function (opts) {
    if (opts == null) {
      opts = {};
    }

    var subscribers = [];
    var init = false;
    var state;

    function unsubscribe(push) {
      // TODO utility for this
      var index = subscribers.indexOf(push);
      @assert.isNot(index, -1);
      subscribers.splice(index, 1);
    }

    function subscribe(push) {
      if (!init) {
        if (opts.init != null) {
          // TODO what if this suspends ?
          state = opts.init();
        }
        init = true;
      }

      subscribers.push(push);

      return state;
    }

    // TODO should this return false when it doesn't have any more subscribers ?
    function publish(x) {
      // TODO super hacky, needed to make error messages work correctly
      //hold(0);

      if (init) {
        if (opts.step != null) {
          // TODO what if this suspends ?
          state = opts.step(state, x);
        }

        var toRemove = [];

        subscribers.forEach(function (f) {
          // TODO assert that `f` doesn't suspend ?
          if (!f(x)) {
            toRemove.push(f);
          }
        });

        toRemove.forEach(function (f) {
          unsubscribe(f);
        });
      }

      // TODO is this correct ?
      return true;
    }

    return {
      subscribe: subscribe,
      unsubscribe: unsubscribe,
      publish: publish
    };
  };
}
