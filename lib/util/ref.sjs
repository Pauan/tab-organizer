@ = require([
  { id: "sjs:observe" },
  { id: "sjs:sequence" },
  { id: "sjs:event" }
])


//exports.empty = {};

exports.Ref = function (value) {
  var self = @Stream(function (emit) {
    emit(self._value);
    self._emitter ..@each(emit);
  });

  self._value   = value;
  self._emitter = @Emitter();

  return self;
};

/*function call(f, array) {
  return f.apply(null, array ..@map(function (obs) {
    return exports.value(obs);
  }));
}*/

exports.value = function (ref) {
  return ref._value;
};

// TODO use an interface for this ?
exports.changes = function (ref) {
  // TODO is this correct ?
  return ref._emitter ..@buffer(Infinity);
};

// TODO maybe use SJS's implementation technique for this ?
exports.replace = function (ref, f) {
  var value_old = exports.value(ref);
  var value_new = f(value_old);
  // TODO if the check fails, maybe retry it, rather than throwing an error ?
  if (value_old === exports.value(ref)) {
    if (value_old !== value_new) {
      ref._value = value_new;
      // TODO use an emit function
      ref._emitter.emit(value_new);
    }
  } else {
    throw new Error("value changed during modify");
  }
};

exports.observe = function (f) {
  var array = [].slice.call(arguments, 1);

  //var ref = exports.Ref();

  array.push(f);

  /*array.push(function () {
    var value = f.apply(null, arguments);
    ref ..exports.replace(function () {
      return value;
    });
  });*/

  return @observe.apply(null, array);
/*
  // TODO is this use of each.par correct ?
  array ..@each.par(function (obs) {
    // TODO use `each` or `each.track` ?
    obs ..@each.track(function () {
      var value = call(f, array);
      ref ..exports.modify(function () {
        return value;
      });
    });
  });*/

  //return ref;
};
