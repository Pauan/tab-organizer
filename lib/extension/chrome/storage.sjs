@ = require([
  { id: "./util" }
]);

exports.get = function () {
  waitfor (var err, result) {
    chrome.storage.local.get(null, function (o) {
      var err = @checkError()
      if (err) {
        resume(err)
      } else {
        resume(null, o)
      }
    });
  // TODO test this
  } retract {
    throw new Error("chrome.storage.get: cannot retract during initialization")
  }

  if (err) {
    throw err
  } else {
    return result
  }
};

exports.set = function (o) {
  waitfor (var err) {
    chrome.storage.local.set(o, function () {
      var err = @checkError();
      if (err) {
        resume(err);
      } else {
        resume(null);
      }
    });
  // TODO test this
  } retract {
    throw new Error("chrome.storage.set: cannot retract");
  }

  if (err) {
    throw err;
  }
};

exports.remove = function (name) {
  waitfor (var err) {
    chrome.storage.local.remove(name, function () {
      var err = @checkError();
      if (err) {
        resume(err);
      } else {
        resume(null);
      }
    });
  // TODO test this
  } retract {
    throw new Error("chrome.storage.remove: cannot retract");
  }

  if (err) {
    throw err;
  }
};

exports.clear = function () {
  waitfor (var err) {
    chrome.storage.local.clear(function () {
      var err = @checkError();
      if (err) {
        resume(err);
      } else {
        resume(null);
      }
    });
  // TODO test this
  } retract {
    throw new Error("chrome.storage.clear: cannot retract");
  }

  if (err) {
    throw err;
  }
};
