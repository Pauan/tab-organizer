/*global Tab */

var Undo = {};

(function () {
    "use strict";

    var rules = {},
        hooks = {};

    var stack = [];

    Undo.setRule = function (name, action) {
        if (typeof action === "function") {
            rules[name] = action;
        }
    };

    Undo.setHook = function (name, action) {
        if (typeof action === "function") {
            hooks[name] = action;
        }
    };

    Undo.push = function (name, info) {
        stack.unshift(Object(info));
        stack.unshift(name);

        var action = hooks[name];
        if (typeof action === "function") {
            action(stack[1]);
        }
    };

    Undo.pop = function () {
        var action = rules[stack[0]];
        if (typeof action === "function") {
            action(stack[1]);
        }
        stack = stack.slice(2);
    };

    Undo.top = function () {
        return {
            name: stack[0],
            info: stack[1] || {}
        };
    };

    Undo.reset = function () {
        stack.length = 0;
    };

    Object.defineProperty(Undo, "length", {
        configurable: false,
        get: function () {
            return stack.length / 2;
        },
        set: function () {}
    });
}());
