@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:object" },
  { id: "sjs:sequence" },
  { id: "lib:extension/server", name: "extension" },
  { id: "lib:util/event" },
  { id: "./tabs", name: "tabs" },
  { id: "./options" }
]);


var matches = {
  "loaded":   @Ref(0),
  "unloaded": @Ref(0)
};

/*
(table matches (primary :type)
  :type   = keyword?
  :amount = number?)

(insert! matches :type = :loaded   :amount = 0)
(insert! matches :type = :unloaded :amount = 0)

(observe display-counter
  (watch matches)
  (watch opt "counter.enabled" "value")
  (watch opt "counter.display.loaded" "value")
  (watch opt "counter.display.unloaded" "value"))
*/

function getType(tab) {
  if (tab ..@has("active")) {
    return matches ..@get("loaded");
  } else {
    return matches ..@get("unloaded");
  }
}

function add1(x) {
  return x + 1;
}

function sub1(x) {
  return x - 1;
}

function process(tab, f) {
  getType(tab) ..@replace(f);
}

@tabs.getWindows() ..@each(function (window) {
  window.tabs ..@each(function (tab) {
    process(tab, add1);
  });
});

// TODO test this
spawn @tabs.events ..@listen(function (x) {
  var type = x ..@get("type");
  if (type === @tabs.open) {
    process(x ..@get("after") ..@get("tab"),  add1);

  } else if (type === @tabs.update) {
    process(x ..@get("before") ..@get("tab"), sub1);
    process(x ..@get("after")  ..@get("tab"), add1);

  } else if (type === @tabs.close) {
    process(x ..@get("before") ..@get("tab"), sub1);
  }
});

function displayCounter(enabled, loaded, unloaded, matches_loaded, matches_unloaded) {
  if (enabled) {
    var i = 0;
    if (loaded) {
      i += matches_loaded;
    }
    if (unloaded) {
      i += matches_unloaded;
    }

    @assert.ok(i >= 0);
    @extension.button.setText(i);
  } else {
    // TODO I don't like how setting this to "" hides the badge
    @extension.button.setText("");
  }
}

/*function tab_matches(tab, loaded, unloaded) {
  return (loaded   &&  tab.active) ||
         (unloaded && !tab.active)
}

var tabCount = @observe([counter_loaded, counter_unloaded], function (loaded, unloaded) {
  return @tabs ..@filter(function (tab) {
    return tab_matches(tab, loaded, unloaded);
  }) ..@count;
});*/

/*spawn @observe([counter_loaded, counter_unloaded], function (loaded, unloaded) {
  var i = 0
  @windows.getCurrent() ..@each(function (window) {
    window.children ..@each(function (tab) {
      if (tab_matches(tab, loaded, unloaded)) {
        ++i
      }
    })
  })
  tabCount.set(i)
})*/

/*spawn @tabs.events ..@each(function (event) {
  if (event.type === "tabs.open") {
    if (tab_matches(event.tab, counter_loaded.get(), counter_unloaded.get())) {
      add1()
    }

  } else if (event.type === "tabs.close") {
    if (tab_matches(event.tab, counter_loaded.get(), counter_unloaded.get())) {
      sub1()
    }
  }
})*/

@extension.button.setColor(0, 0, 0, 0.9);

spawn displayCounter ..@observe(
  @opt.ref("counter.enabled"),
  @opt.ref("counter.display.loaded"),
  @opt.ref("counter.display.unloaded"),
  matches ..@get("loaded"),
  matches ..@get("unloaded")
);

console.info("counter: finished");
