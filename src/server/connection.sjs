@ = require([
  { id: "sjs:collection/immutable" },
  { id: "lib:util/publisher" },
  { id: "lib:extension/server" }
]);

exports.on            = {};
exports.on.send       = "__7454FFA4-244F-4909-960D-AA4B63CEAB48_send__";
exports.on.connect    = "__9475FE19-52DF-41ED-B042-500ED6E6081C_connect__";
exports.on.disconnect = "__239EA2C4-0DB1-48C5-AE0B-9365B1012F22_disconnect__";

var { subscribe, publish } = @Publisher({
  init: function () {
    return @connection.subscribe(publish);
  }
});

exports.subscribe = function (push, name) {
  var state = subscribe(function (event) {
    var type = event.type;
    if (type === @connection.on.connect) {
      if (event.name === name) {
        return push(@Dict({
          "type": exports.on.connect,
          "id": event.id
        }));
      } else {
        return true;
      }

    } else if (type === @connection.on.disconnect) {
      if (event.name === name) {
        return push(@Dict({
          "type": exports.on.disconnect,
          "id": event.id
        }));
      } else {
        return true;
      }

    } else if (type === @connection.on.send) {
      if (event.name === name) {
        return push(@Dict({
          "type": exports.on.send,
          "id": event.id,
          // TODO fromJS
          "value": event.value
        }));
      } else {
        return true;
      }

    } else {
      @assert.fail();
    }
  });

  state = state.filter(function (x) {
    return x.name === name;
  });

  state = state.map(function (x) {
    return x.id;
  });

  return @List(state);
};

exports.step = function (state, event) {
  var type = event.get("type");

  if (type === exports.on.connect) {
    return state.insert(event.get("id"));

  } else if (type === exports.on.disconnect) {
    return state.remove(state ..@indexOf(event.get("id")));

  } else {
    return state;
  }
};

exports.send = function (id, value) {
  console.log("CONNECTION", id, value);
  // TODO test this
  return @connection.send(id, @toJS(value));
};
