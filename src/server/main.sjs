var start_time = Date.now();

require("../hubs");

@ = require([
  { id: "sjs:collection/immutable", exclude: ["Queue"] },
  { id: "lib:util/queue" },
  { id: "lib:extension/server" },
  { id: "./windows", name: "windows" }
]);

var { push, pull } = @Queue();

var current_state = @Dict({
  "connections": @connection.init(push),
  "windows": @windows.init(push)
});

window.showState = function () {
  console.log(@toJS(current_state));
};

function step(state, event) {
  console.log("main:", event);

  state = state.modify("connections", function (state) {
    return @connection.step(state, event);
  });

  state = state.modify("windows", function (state) {
    return @windows.step(state, event);
  });

  current_state = state;

  return state;
}

var end_time = Date.now();

console.info("main: initialized, took #{end_time - start_time}ms");

pull ..@foldq(current_state, step);

/*

@ = require([
  { id: "lib:util/queue" },
  { id: "./tabs", name: "tabs" },
  { id: "./popup", name: "popup" },
  { id: "./counter", name: "counter" }
]);

// TODO if (require.main === module) { ?

var { push, pull } = @Queue();

console.info("main: init");

var state = {
  tabs:    @tabs.init(push),
  popup:   @popup.init(push),
  counter: @counter.init(push)
};

function step(state, event) {
  state.tabs    = @tabs.step(state.tabs, event);
  state.popup   = @popup.step(state.popup, event);
  state.counter = @counter.step(state.counter, event);
  return state;
}

*/
