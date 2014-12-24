@ = require([
  { id: "sjs:sequence" },
  { id: "sjs:object" },
  { id: "lib:util/util" },
  { id: "lib:util/publisher" },
  { id: "../chrome/util" }
]);

var queue       = {};
var ports_by_id = {};
var id_counter  = 0;

exports.on            = {};
exports.on.send       = "__9297FE86-A635-4C4F-842E-3A5E7B2A7066_send__";
exports.on.connect    = "__5E2EAD46-02CA-45B4-BCB8-93F67749D2A4_connect__";
exports.on.disconnect = "__04E7DEBF-2E5B-41B5-9FBA-06C21C30B2D3_disconnect__";

var { subscribe, publish } = @Publisher({
  init: function () {
    return ports_by_id ..@items ..@map(function ([key, value]) {
      return {
        id: key,
        name: value.name
      };
    });
  }
});

// TODO what about when the port disconnects, is it okay to call postMessage ?
chrome.runtime.onConnect.addListener(function (port) {
  @throwError();

  var name = port.name;
  var id = (++id_counter);

  ports_by_id ..@setNew(id, port);

  port.onDisconnect.addListener(function () {
    @throwError();

    ports_by_id ..@delete(id);

    publish({
      type: exports.on.disconnect,
      name: name,
      id: id
    });
  });

  port.onMessage.addListener(function (o) {
    @throwError();

    o ..@each(function (o) {
      publish({
        type: exports.on.send,
        name: name,
        id: id,
        value: o
      });
    });
  });

  publish({
    type: exports.on.connect,
    name: name,
    id: id
  });
});

exports.subscribe = subscribe;

exports.step = function (state, event) {
  var type = event.type;
  if (type === exports.on.connect) {
    return state.push(event.id);

  } else if (type === exports.on.disconnect) {
    return state ..@remove(event.id);

  } else {
    return state;
  }
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
