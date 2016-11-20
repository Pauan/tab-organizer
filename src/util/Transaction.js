"use strict";


var globalTransactionId = 0;

exports.runTransaction = function (transaction) {
  return function () {
    var state = [];

    try {
      var value = transaction(state);

      var id = globalTransactionId++;

      var length = state.length;

      for (var i = 0; i < length; ++i) {
        // TODO what if this throws an error ?
        state[i].commit(id);
      }

      return value;

    } catch (e) {
      // TODO make this faster ?
      // TODO is this correct ?
      state.reverse();

      var length = state.length;

      for (var i = 0; i < length; ++i) {
        state[i].rollback();
      }

      throw e;
    }
  };
};


exports.mapImpl = function (f) {
  return function (transaction) {
    return function (state) {
      return f(transaction(state));
    };
  };
};


// TODO test this
// TODO verify that this follows the Apply laws
exports.applyImpl = function (transaction1) {
  return function (transaction2) {
    return function (state) {
      var a = transaction1(state);
      var b = transaction2(state);
      return a(b);
    };
  };
};


// TODO test this
// TODO verify that this follows the Bind laws
exports.bindImpl = function (transaction) {
  return function (f) {
    return function (state) {
      var a = transaction(state);
      return f(a)(state);
    };
  };
};


exports.pureImpl = function (value) {
  return function (state) {
    return value;
  };
};


// TODO move this someplace else ?
function noop() {}

// TODO test this
exports.onCommitImpl = function (unit) {
  return function (eff) {
    return function (state) {
      state.push({
        rollback: noop,
        commit: function () {
          eff();
        }
      });

      return unit;
    };
  };
};
