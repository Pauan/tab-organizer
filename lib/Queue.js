var Queue = (function () {
    "use strict";

    function make() {
        var results = [],
            stack = [],
            queue = [];

        function buildControl(queue) {
            var obj = {
                next: function () {
                    obj.next = function () {};
                    stack.shift();

                    var first = stack[0];
                    if (first) {
                        first(buildControl(queue));
                    } else {
                        queue();
                    }
                }
            };
            return obj;
        }

        var obj = {
            make: make,

            sync: function (func) {
                if (typeof func === "function") {
                    stack.push(func);

                    if (stack.length === 1) {
                        func(buildControl(obj.async()));
                    }
                }
            },

            async: function (func) {
                var index = queue.push(func) - 1;

                return function () {
                    if (index === null) {
                        return;
                    }

                    results[index] = Array.prototype.slice.call(arguments);
                    index = null;

                    for (var i = 0; i < queue.length; i += 1) {
                        if (results[i]) {
                            if (typeof queue[i] === "function") {
                                queue[i].apply(null, results[i]);
                                delete queue[i];
                            }
                        } else {
                            return;
                        }
                    }

                    queue.length = results.length = 0;
                };
            },

            run: function (func) {
                return obj.async(func)();
            }
        };
        return obj;
    }

    return make();
}());
