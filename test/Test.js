"use strict";


exports.unsafeEq = function (a) {
  return function (b) {
    return a === b;
  };
};
