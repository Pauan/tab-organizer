@ = require([
  { id: "sjs:sequence" },
  { id: "sjs:object" },
  { id: "lib:util/util" },
  { id: "../chrome/util" }
]);

var queue       = {};
var ports_by_id = {};
var id_counter  = 0;

exports.on            = {};
exports.on.send       = {};
exports.on.connect    = {};
exports.on.disconnect = {};

exports.init = function (push) {
  // TODO what about when the port disconnects, is it okay to call postMessage ?
  chrome.runtime.onConnect.addListener(function (port) {
    @throwError();

    var id = (++id_counter);

    ports_by_id ..@setNew(id, port);

    port.onDisconnect.addListener(function () {
      @throwError();

      ports_by_id ..@delete(id);

      push({
        type: exports.on.disconnect,
        id: id
      });
    });

    port.onMessage.addListener(function (o) {
      @throwError();

      o ..@each(function (o) {
        push({
          type: exports.on.send,
          id: id,
          value: o
        });
      });
    });

    push({
      type: exports.on.connect,
      id: id
    });
  });

  return ports_by_id ..@items ..@map(function ([key, value]) {
    return key;
  });
};

exports.send = function (id, value) {
  var a = queue[id];
  // TODO object/has
  if (a == null) {
    a = queue ..@setNew(id, [value]);

    var port = ports_by_id ..@get(id);

    setTimeout(function () {
      // TODO what if the port is closed ?
      port.postMessage(a);
      queue ..@delete(id);
    }, 100);
  } else {
    // TODO pushNew ?
    a.push(value);
  }
};
