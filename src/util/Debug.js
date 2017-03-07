"use strict";


exports.onErrorImpl = function (unit) {
  return function (f) {
    return function () {
      var crashed = false;

      window.addEventListener("error", function (e) {
        console.info(e);

        if (!crashed) {
          crashed = true;

          if (e.error == null) {
            // TODO non-standard
            f(new Error(e.message, e.filename, e.lineno))();

          } else {
            f(e.error)();
          }
        }
      }, true);

      return unit;
    };
  };
};


exports.alertErrorImpl = function (unit) {
  return function (e) {
    return function () {
      // TODO better implementation of this ?
      alert(e.stack || e.message);
      return unit;
    };
  };
};
