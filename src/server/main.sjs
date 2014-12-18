console.info("main: initializing");

require("../hubs");

@ = require([
  { id: "sjs:collection/immutable", exclude: ["Queue"] },
  { id: "lib:util/queue" },
  { id: "./session", name: "session" }
]);

var { push, pull } = @Queue();

var current_state = @Dict({
  "session": @session.window.init(push)
});

window.showState = function () {
  console.log(@toJS(current_state));
};

function step(state, event) {
  console.log(event);

  state = state.modify("session", function (session) {
    return @session.window.step(session, event);
  });

  current_state = state;

  return state;
}

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
