var start_time = Date.now();

require("../hubs");

@ = require([
  { id: "sjs:collection/immutable", exclude: ["Queue"] },
  { id: "lib:util/queue" },
  { id: "lib:util/util" },
  { id: "sjs:sequence" },
  { id: "./windows", name: "windows" }
]);

var { push, pull } = @Queue();

var current_state = @Dict({
  "windows": @windows.subscribe(push)
});

window.showState = function () {
  console.log(@toJS(current_state));
};


window.search = function (url) {
  var re = new RegExp(@regexpEscape(url), "i");

  return current_state.get("windows").get("tab-ids") ..@filter(function ([_, tab]) {
    return (tab.has("url") && re.test(tab.get("url"))) ||
           (tab.has("title") && re.test(tab.get("title")));
  }) ..@map(function ([_, tab]) {
    return @toJS(tab)
  });
};


function step(state, event) {
  console.log("main:", @toJS(event));

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
  tabs:    @tabs.subscribe(push),
  popup:   @popup.subscribe(push),
  counter: @counter.subscribe(push)
};

function step(state, event) {
  state.tabs    = @tabs.step(state.tabs, event);
  state.popup   = @popup.step(state.popup, event);
  state.counter = @counter.step(state.counter, event);
  return state;
}

*/
