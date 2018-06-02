/*global chrome */

(function () {
    "use strict";

    Object.copy = function (object, filter) {
        var copy = {};

        Object.keys(object).forEach(function (key) {
            var value = object[key];
            if (typeof filter === "function") {
                value = filter.call(object, key, value);
                if (typeof value !== "undefined") {
                    copy[key] = value;
                }
            } else {
                copy[key] = value;
            }
        });

        return copy;
    };

    var port = chrome.extension.connect({ name: "lib.keyboard" });

    function sendMessage(event) {
        var object = Object.copy(event, function (key, value) {
            if (value instanceof Object) {
                return;
            }
            return value;
        });
        port.postMessage(object);
    }

    addEventListener("keydown", sendMessage, true);
    //! addEventListener("keyup", sendMessage, true);
}());
