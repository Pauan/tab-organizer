"use strict";


// TODO https://github.com/purescript/purescript/issues/2290
var pending, animating, sequence_, runTransaction;

pending = false;
animating = [];


// TODO make this faster ?
// TODO test this
function nextFrame() {
  var now = performance.now();

  // TODO precompute the size ?
  var transactions = [];

  var length = animating.length;

  for (var i = 0; i < length;) {
    var x = animating[i];

    var diff = now - x.startTime;
    var duration = x.duration;

    if (diff >= duration) {
      transactions.push(x.set(x.end)(x.tween));
      animating.splice(i, 1); // TODO make this faster ?
      --length;

    } else {
      transactions.push(x.set(range(diff / duration, x.start, x.end))(x.tween));
      ++i;
    }
  }

  if (transactions.length === 1) {
    // TODO make this faster ?
    runTransaction(transactions[0])();

  } else {
    // TODO make this faster ?
    runTransaction(sequence_(transactions))();
  }

  // TODO test this
  if (length === 0) {
    pending = false;

  } else {
    return requestAnimationFrame(nextFrame);
  }
}


function range(tween, from, to) {
  return (tween * (to - from)) + from;
}


function pause(animation) {
  var f = animation.stop;

  if (f !== null) {
    animation.stop = null;
    f();
  }
}


// TODO test this
function play(set, animation) {
  var tween = animation.tween;
  var start = tween.snapshot.value; // TODO don't rely upon implementation details
  var end = animation.tweenTo;

  if (start !== end) {
    var duration = animation.duration;

    if (duration === 0) {
      // TODO is this correct ?
      throw new Error("Cannot tween when the duration is 0");

    } else {
      // TODO is this correct ?
      var startTime = performance.now();

      var info = {
        startTime: startTime,
        duration: Math.abs(end - start) * duration,
        start: start,
        end: end,
        tween: tween,
        set: set
      };

      animating.push(info);

      if (!pending) {
        pending = true;
        requestAnimationFrame(nextFrame);
      }

      // TODO test this
      // TODO what if this is called twice ?
      // TODO what if this is called after the animation is finished ?
      // TODO what if this is called during an animation ?
      animation.stop = function () {
        var index = animating.indexOf(info);

        if (index !== -1) {
          animating.splice(index, 1);
        }
      };
    }
  }
}


exports.rangeImpl = function (from) {
  return function (to) {
    return function (tween) {
      return range(tween, from, to);
    };
  };
};


exports.makeImpl = function (mutable) {
  return function (duration) {
    return function () {
      return {
        tween: mutable(),
        tweenTo: 0,
        duration: duration,
        playing: true,
        stop: null
      };
    };
  };
};


exports.viewImpl = function (view) {
  return function (animation) {
    return view(animation.tween);
  };
};


// TODO test this
exports.jumpToImpl = function (set) {
  return function (tween) {
    return function (animation) {
      return function (state) {
        if (animation.playing) {
          // TODO is this correct ?
          pause(animation);
        }

        animation.tweenTo = tween;

        return set(tween)(animation.tween)(state);
      };
    };
  };
};


exports.tweenToImpl = function (set) {
  return function (sequence_1) {
    // TODO hacky
    sequence_ = sequence_1;

    return function (runTransaction1) {
      // TODO hacky
      runTransaction = runTransaction1;

      return function (unit) {
        return function (tween) {
          return function (animation) {
            return function () {
              // TODO is this correct ?
              if (animation.tweenTo !== tween) {
                animation.tweenTo = tween;

                if (animation.playing) {
                  // TODO is this correct ?
                  pause(animation);
                  play(set, animation);
                }
              }

              return unit;
            };
          };
        };
      };
    };
  };
};
