/*global Options */

(function () {
    "use strict";

    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";


    function href(value) {
        return "/views/" + value + ".css";
    }

    link.href = href(Options.get("windows.type"));


    function find(text, func) {
        var rules = link.sheet.cssRules; // error here:
                                         // Uncaught TypeError: Cannot read property 'cssRules' of null

        for (var i = 0; i < rules.length; i += 1) {
            if (rules[i].selectorText === text) {
                func(rules[i]);
                return;
            }
        }
    }

    var types = {
        "grid": function () {
            find(".window", function (rule) {
                var width = Options.get("windows.grid.columns");
                rule.style.width = 100 / width + "%";

                var height = Options.get("windows.grid.rows");
                rule.style.height = 100 / height + "%";
            });
        }
    };
///*                    if (state.loaded) {

    var update = (function () {
        var url, done, value;

        var request = new XMLHttpRequest();

        request.addEventListener("load", function () {
            link.href = url;

            var action = types[value];
            if (action) {
                action();
            }

            if (typeof done === "function") {
                done();
            }
        }, true);

        return function (action) {
            value = Options.get("windows.type");
            url = href(value);
            done = action;


            request.open("GET", url, true);
            request.send(null);
        };
    }());



    Options.event.on("change", function (event) {
        var columns = (event.name === "windows.grid.columns"),
            rows    = (event.name === "windows.grid.rows"),
            type    = (event.name === "windows.type");

        if (columns || rows || type) {
            update(function () {
                state.search({ scroll: true, focused: true, nodelay: true });
            });
        }
    });

    document.head.appendChild(link);
    update();
}());
