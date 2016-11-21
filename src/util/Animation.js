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

  // TODO should this run new animations or not ?
  for (var i = 0; i < length;) {
    var x = animating[i];

    var diff = now - x.startTime;
    var duration = x.duration;

    if (diff >= duration) {
      transactions.push(x.set(x.end)(x.tween));
      transactions.push(x.done);

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

  // Cannot use `length` because new animations might have been added
  if (animating.length === 0) {
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
function play(set, animation, duration, done) {
  var tween = animation.tween;
  var start = tween.snapshot.value; // TODO don't rely upon implementation details
  var end = animation.tweenTo;

  if (start !== end) {
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
        set: set,
        done: done
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
  return function () {
    return {
      tween: mutable(),
      tweenTo: 0,
      playing: true,
      stop: null
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
          return function (duration) {
            return function (animation) {
              return function (done) {
                return function (state) {
                  // TODO is this correct ?
                  if (animation.tweenTo !== tween) {
                    animation.tweenTo = tween;

                    if (animation.playing) {
                      // TODO is this correct ?
                      pause(animation);
                      play(set, animation, duration, done);
                      return unit;

                    // TODO is this correct ?
                    } else {
                      return done(state);
                    }

                  } else {
                    // TODO is this correct ?
                    return done(state);
                  }
                };
              };
            };
          };
        };
      };
    };
  };
};


// Easings
exports.easePow = function (pow) {
  return function (t) {
    return Math.pow(t, pow);
  };
};


var tau = Math.PI / 2;

exports.easeSinusoidal = function (t) {
  // TODO is this correct ?
  if (t === 1) {
    return 1;

  } else {
    return 1 - Math.cos(t * tau);
  }
};


exports.easeExponential = function (t) {
  // TODO is this correct ?
  if (t === 0) {
    return 0;

  } else {
    return Math.pow(2, 10 * (t - 1));
  }
};


exports.easeCircular = function (t) {
  return 1 - Math.sqrt(1 - t * t);
};


exports.easeOut = function (f) {
  return function (t) {
    return 1 - f(1 - t);
  };
};


// TODO test this
exports.easeInOut = function (f) {
  return function (t) {
    if (t <= 0.5) {
      return f(t * 2) / 2;

    } else {
      return 1 - (f((1 - t) * 2) / 2);
    }
  };
};


// TODO is this correct ?
// TODO can this be made faster ?
exports.easeRepeat = function (amount) {
  return function (t) {
    if (t === 1) {
      return 1;

    } else {
      return (t * amount) % 1;
    }
  };
};


// TODO test this
exports.animatedMapImpl = function (eachDelta, arrayDelta, view, Replace, Insert, Update, Remove, unit, make) {
  function noop() {
    return unit;
  }

  return function (f) {
    return function (replace) {
      return function (insert) {
        return function (update) {
          return function (remove) {
            return function (stream) {
              // TODO don't rely upon this implementation detail ?
              return function (onValue, onError, onComplete) {
                return function () {
                  var indexes = [];
                  var values = [];

                  function onReplace(array) {
                    return function () {
                      var length = array.length;

                      var output = new Array(length);
                      indexes = new Array(length);
                      values = new Array(length);

                      for (var i = 0; i < length; ++i) {
                        var animation = make();

                        // TODO what about if it's cancelled ?
                        replace(animation)(noop)();

                        var value = f(view(animation))(array[i]);

                        indexes[i] = i;

                        values[i] = {
                          parentIndex: i,
                          index: i,
                          animation: animation
                        };

                        output[i] = value;
                      }

                      return onValue(Replace(output))();
                    };
                  }

                  function onInsert(index) {
                    return function (v) {
                      return function () {
                        var animation = make();

                        // TODO what about if it's cancelled ?
                        insert(animation)(noop)();

                        var value = f(view(animation))(v);

                        var length = indexes.length;

                        var realIndex =
                          (index < length
                            ? indexes[index]
                            : values.length);

                        indexes.splice(index, 0, realIndex);

                        values.splice(realIndex, 0, {
                          parentIndex: index,
                          index: realIndex,
                          animation: animation
                        });

                        for (var i = index + 1; i < length; ++i) {
                          ++indexes[i];
                        }

                        var length = values.length;

                        for (var i = realIndex + 1; i < length; ++i) {
                          ++values[i].parentIndex;
                          ++values[i].index;
                        }

                        return onValue(Insert(realIndex)(value))();
                      };
                    };
                  }

                  function onUpdate(index) {
                    return function (v) {
                      return function () {
                        var realIndex = indexes[index];

                        var info = values[realIndex];

                        // TODO what about if it's cancelled ?
                        update(info.animation)(noop)();

                        var value = f(view(info.animation))(v);

                        return onValue(Update(realIndex)(value))();
                      };
                    };
                  }

                  function onRemove(index) {
                    return function () {
                      var realIndex = indexes[index];

                      var info = values[realIndex];

                      indexes.splice(index, 1);

                      var length = values.length;

                      // TODO test this
                      for (var i = realIndex + 1; i < length; ++i) {
                        --values[i].parentIndex;
                      }

                      // TODO what about if it's cancelled ?
                      remove(info.animation)(function () {
                        var realIndex = info.index;

                        values.splice(realIndex, 1);

                        var length = indexes.length;

                        for (var i = info.parentIndex; i < length; ++i) {
                          --indexes[i];
                        }

                        var length = values.length;

                        for (var i = realIndex; i < length; ++i) {
                          --values[i].index;
                        }

                        return onValue(Remove(realIndex))();
                      })();

                      return unit;
                    };
                  }

                  return eachDelta(arrayDelta(onReplace)(onInsert)(onUpdate)(onRemove))(onError)(onComplete)(stream)();
                };
              };
            };
          };
        };
      };
    };
  };
};
