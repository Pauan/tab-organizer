/*global _gaq, Options, Platform */
"use strict";

var defaults = {
    "popup.type": "popup",
    "popup.offsetX": 0,
    "popup.offsetY": 0,
    "popup.width": 920,  //! screen.width - 520, // 100 // 916 // 1336 // 960
    "popup.height": 496, //! screen.height - 400 // 250 // 502 // 632

    "popup.hotkey.ctrl": true,
    "popup.hotkey.shift": true,
    "popup.hotkey.alt": false,
    "popup.hotkey.letter": "E",
    "popup.close.escape": false,
    "popup.switch.action": "minimize",
    "popup.close.when": "switch-tab", // "manual",

    "undo.new-tab": true,
    "undo.rename-window": true,
    "undo.select-tabs": true,
    "undo.pin-tabs": true,
    "undo.favorite-tabs": true,
    "undo.move-tabs": true,
    "undo.close-tabs": false,
    "undo.timer": 10,

    "color.theme": "Blue",

    "tabs.close.location": "right",
    "tabs.close.display": "hover",
    "tabs.click.type": "focus",
    "tabs.tree-style.enabled": true,
    "tabs.sort.type": "index <",

    "windows.middle-close": false,
    "windows.type": "horizontal",
    "windows.grid.columns": 3,
    "windows.grid.rows": 1.5,
    "windows.sort.type": "date-created <",

    "windows.button.dropdown": true,
    "windows.button.close": false,

    "counter.enabled": true,
    "counter.type": "total",
    "counter.reset.whenlower": true,
    "counter.reset.number": 0,
    "counter.reset.time": false,
    "counter.reset.time.hour": "00",
    "counter.reset.time.minute": "00",
    "counter.reset.idle": false,
    "counter.reset.idle.hour": 10,

    "search.show-number": 5,

    "usage-tracking": true
};
Options.setDefaults(defaults);


Options.setObject("tabs.favorites.urls");
Options.setObject("tabs.visited.byURL");
Options.setObject("counter.state");

Options.setArray("search.past-queries");
Options.setArray("windows.tab-indent");
Options.setArray("windows.titles");
Options.setArray("macros.list");


(function () {
    var hour = Options.get("counter.reset.time.hour");
    if (hour === "0" || hour === 0) {
        Options.set("counter.reset.time.hour", "00");
    }

    var minute = Options.get("counter.reset.time.minute");
    if (minute === "0" || minute === 0) {
        Options.set("counter.reset.time.minute", "00");
    }

    if (Options.get("windows.sort.type") === "date-created") {
        Options.set("windows.sort.type", "date-created <");
    }

    if (Options.get("windows.sort.type") === "tab-number") {
        Options.set("windows.sort.type", "tab-number >");
    }

    if (Options.get("tabs.close.display") === "always") {
        Options.set("tabs.close.display", "every");
    }

    if (Options.get("popup.close.when") === "manual") {
        Options.set("popup.close.action", "minimize");
        Options.set("popup.close.when", "switch-tab");
    }

    /*(when (is (option popup.close.when) "manual")
        (= (option popup.close.action) "minimize")
        (= (option popup.close.when) "switch-tab"))*/
}());


var config = Options.snapshot().user;
var code = "usage-tracking";

if (Options.get(code)) {
    _gaq.push(["_trackEvent", "Version", "number", "4.3"]);

    //_gaq.push(["_trackEvent", "Version", "type", "developer"]);
    _gaq.push(["_trackEvent", "Version", "type", "normal"]);

    (function () {
        var favorites = Options.get("tabs.favorites.urls").keys().length;
        if (favorites !== 0) {
            _gaq.push(["_trackEvent", "Favorites", "tabs.favorites.urls", favorites + "", favorites]);
        }

        var macros = Options.get("macros.list").length;
        if (macros !== 0) {
            _gaq.push(["_trackEvent", "Macros", "macros.list", macros + "", macros]);
        }
    }());
}


var categories = {
    "Counter": ["counter.enabled", "counter.type", "counter.reset.whenlower", "counter.reset.number", "counter.reset.time", "counter.reset.time.hour", "counter.reset.time.minute", "counter.reset.idle", "counter.reset.idle.hour"],

    "Experimental": ["windows.middle-close", "popup.close.escape"],

    "Keyboard": ["popup.hotkey.ctrl", "popup.hotkey.shift", "popup.hotkey.alt", "popup.hotkey.letter"],

    "Popup": ["popup.switch.action", "popup.close.when", "popup.type", "popup.offsetX", "popup.offsetY", "popup.width", "popup.height"],

    "Privacy": ["usage-tracking"],

    "Search": ["search.show-number"],

    "Tabs": ["tabs.close.location", "tabs.close.display", "tabs.tree-style.enabled", "tabs.click.type"],

    "Theme": ["color.theme"],

    "Undo": ["undo.new-tab", "undo.rename-window", "undo.select-tabs", "undo.pin-tabs", "undo.favorite-tabs", "undo.move-tabs", "undo.close-tabs", "undo.timer"],

    "Windows": ["windows.type", "windows.grid.columns", "windows.grid.rows", "windows.button.dropdown", "windows.button.close"],

    "Statistics": ["windows.sort.type", "tabs.sort.type"],
};

Object.keys(categories).forEach(function (category) {
    categories[category].forEach(function (name) {
        if (Options.get(code) || name === code) {
            if (!Options.isDefault(name)) {
                var value = Options.get(name);
                if (typeof value === "number") {
                    _gaq.push(["_trackEvent", category, name, value + "", value]);
                } else {
                    _gaq.push(["_trackEvent", category, name, value + ""]);
                }
            }
        }
    });
});


var state = {
    indent: Options.get("windows.tab-indent")
};

var counter = Options.get("counter.state");

counter.reset = function (should) {
    var reset = Options.get("counter.reset.number");
    var lower = Options.get("counter.reset.whenlower");

    /**
     *  Only reset under the following conditions:
     *    1. If explicitly told to, via the argument `should`
     *    2. If lower is unchecked
     *    3. If lower is checked, and the counter's number is lower than the reset number
     */
    if (should || !lower || counter.get("session-number") < reset) {
        counter.set("session-number", reset);
        counter.update();
    }
};

counter.timestamp = function () {
    var date = new Date();
    date.setHours(Options.get("counter.reset.time.hour"));
    date.setMinutes(Options.get("counter.reset.time.minute"));
    counter.set("timestamp", date.getTime());
};
counter.timestamp();


counter.update = function (value) {
    if (Options.get("counter.enabled")) {
        switch (Options.get("counter.type")) {
        case "total":
            value = counter.get("total-number");
            if (!value) {
                value = "";
            }
            Platform.icon.setBackgroundColor({ color: [0, 0, 0, 255] });
            break;
        case "session":
            value = counter.get("session-number");

            if (typeof value === "undefined") {
                value = Options.get("counter.reset.number");
            }

            if (value > 0) {
                Platform.icon.setBackgroundColor({ color: [225, 0, 0, 255] });
            } else {
                Platform.icon.setBackgroundColor({ color: [0, 100, 0, 255] });
            }
        }

        Platform.icon.setText({ text: value });
    } else {
        Platform.icon.setText({ text: "" });
    }
};
counter.update();


var day = 1000 * 60 * 60 * 24;

(function anon() {
    if (Options.get("counter.reset.time")) {
        var time = new Date() - day;
        if (time > counter.get("timestamp")) {
            counter.timestamp();
            counter.reset();
        }
    }

    if (Options.get("counter.reset.idle")) {
        var hours = Options.get("counter.reset.idle.hour") * 60 * 60;
        Platform.idle.queryState(hours, function (state) {
            if (state === "idle") {
                counter.reset();
            }
        });
    }

    setTimeout(anon, 60000);
}());


Platform.event.on("load", function (windows) {
    var titles = Options.get("windows.titles"),
        indent = state.indent;

    var tabcount = 0;

    windows.forEach(function (item, i) {
        var length = item.tabs.length;
        tabcount += length;

        var level = indent[i];
        if (level && level.length > length) {
            level.length = length;
        }
    });

    function fit() {
        for (var i = 0; i < arguments.length; i += 1) {
            if (arguments[i].length > windows.length) {
                arguments[i].length = windows.length;
            }
        }
    }

    fit(indent, titles);



    function trim(array, action) {
        var last = -1;

        array.forEach(function (item, i) {
            if (item) {
                last = i;

                if (typeof action === "function") {
                    action(item, i);
                }
            } else {
                delete array[i];
            }
        });

        array.length = last + 1;
    }

    trim(indent, function (item, i) {
        trim(item);

        if (item.length === 0) {
            delete indent[i];
        }
    });


    counter.set("total-number", tabcount);
    counter.update();

    if (Options.get(code)) {
        _gaq.push(["_trackEvent", "Statistics", "windows.length", windows.length + "", windows.length]);
        _gaq.push(["_trackEvent", "Statistics", "tabs.length", tabcount + "", tabcount]);
    }

    Platform.event.on("tab-create", function (tab) {
        if (tab.window.type === "normal") {
            counter.set("total-number", counter.get("total-number") + 1);
            counter.set("session-number", counter.get("session-number") + 1);
            counter.update();
        }
    });

    Platform.event.on("tab-remove", function (tab) {
        if (tab.window.type === "normal") {
            counter.set("total-number", counter.get("total-number") - 1);
            counter.set("session-number", counter.get("session-number") - 1);
            counter.update();
        }
    });
});



if (Options.get("popup.type") === "bubble") {
    Platform.icon.setPopup({ popup: "window.html" });
}


Options.event.on("change", function (event) {
    switch (event.name) {
    case "counter.reset.time.hour": //* FALLTHRU
    case "counter.reset.time.minute":
        counter.timestamp();
        break;
    case "counter.type":
        counter.update();
        break;
    case "counter.enabled":
        if (event.value) {
            if (!counter.get("first-run")) {
                counter.set("first-run", true);
                counter.reset();
            }
        }
        counter.update();
        break;
    case "popup.type":
        Platform.icon.setPopup({
            popup: (event.value === "bubble") ? "window.html" : ""
        });
    }
});


function updateTitle() {
    var title = [ "Tab Organizer (" ];

    if (Options.get("popup.hotkey.ctrl")) {
        title.push("Ctrl ");
    }
    if (Options.get("popup.hotkey.shift")) {
        title.push("Shift ");
    }
    if (Options.get("popup.hotkey.alt")) {
        title.push("Alt ");
    }

    title.push(Options.get("popup.hotkey.letter"), ")");

    Platform.icon.setTitle({ title: title.join("") });
}
updateTitle();


var openPopup = (function () {
    function popup(url, info, options) {
        info = Object(info);

        var x = screen.width * (info.offsetX / 100 + 0.5) - (info.width + 8) / 2,
            y = screen.height * (info.offsetY / 100 + 0.5) - (info.height + 24) / 2;

        options += ",left=" + x;
        options += ",top=" + y;
        options += ",outerWidth=" + info.width;
        options += ",width=" + info.width;
        options += ",outerHeight=" + info.height;
        options += ",height=" + info.height;
        return open(url, "TabOrganizer", options);
    }

    return function () {
        if (state.opened) {
            Platform.tabs.remove(state.opened);
        }

        return popup("window.html", {
            offsetX: Options.get("popup.offsetX"),
            offsetY: Options.get("popup.offsetY"),
            width: Options.get("popup.width"),
            height: Options.get("popup.height")
        });
        /*! , "toolbar=1,menubar=1,alwaysRaised=1"*/
    };
}());

var showTabOrganizer = function anon() {
    var popup = anon.popup;
    if (popup && !popup.closed) {
        popup.addEventListener("unload", showTabOrganizer, false);
        popup.close();
        delete anon.popup;
        return null;
    }

    switch (Options.get("popup.type")) {
    case "bubble":
        anon.popup = openPopup();
        break;
    case "popup":
        anon.popup = openPopup();
        break;
    case "tab":
        if (state.opened) {
            Platform.tabs.focus(state.opened, true);
        } else if (state.opened !== null) {
            state.opened = null;

            Platform.tabs.create({
                url: "window.html"
            }, function (tab) {
                state.opened = tab;
            });
        }
    }
};
Platform.event.on("icon-click", showTabOrganizer);

Platform.event.on("tab-remove", function (tab) {
    if (state.opened && state.opened.id === tab.id) {
        delete state.opened;
    }
});


(function () {
    var visitedByURL = Options.get("tabs.visited.byURL");

    var offset = Date.now() - 1000 * 60 * 60 * 24 * 7;

    visitedByURL.keys().forEach(function (key) {
        var value = visitedByURL.get(key);
        if (offset > value) {
            visitedByURL.set(key, null);
        }
    });
//
//            console.log(visitedByURL.keys().length);


    function add(url) {
        if (url) {
            visitedByURL.set(url, Date.now());
        }
    }

    Platform.event.on("tab-focus", function (tab) {
        add(tab.url);
    });

    Platform.event.on("tab-update", function (tab) {
        if (tab.status === "loading" && tab.selected) {
            add(tab.url);
        }
    });
}());

Platform.event.on("window-focus", function (win) {
    if (win.type === "normal") {
        Options.set("window.lastfocused", win.id);
    }
});

Platform.message.on("lib.keyboard", function (event) {
    if (event.type === "keydown") {
        var ctrl = Options.get("popup.hotkey.ctrl");
        var letter = String.fromCharCode(event.which);

        if (event.ctrlKey === ctrl || event.metaKey === ctrl) {
            if (event.shiftKey === Options.get("popup.hotkey.shift")) {
                if (event.altKey === Options.get("popup.hotkey.alt")) {
                    if (letter === Options.get("popup.hotkey.letter")) {
                        showTabOrganizer();
                    }
                }
            }
        }
    }
});
