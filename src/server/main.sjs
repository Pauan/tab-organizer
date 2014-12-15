require("../hubs");

@ = require([
  { id: "sjs:collection/immutable" },
  { id: "lib:util/queue" },
  { id: "./session", name: "session" }
]);

var { push, pull } = @Queue();

// TODO
var state = @Dict({
  "session": @session.init(push)
});

function step(state, event) {
  state = state.modify("session", function (session) {
    return @session.step(session, event);
  });
  console.log("" + state);
  return state;
}

pull ..@foldq(state, step);

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
