(function () {
    "use strict";

    var proto = Array.prototype;

    proto.add = function (item) {
        var index = this.indexOf(item);
        if (index === -1) {
            this.push(item);
            return true;
        }
        return false;
    };

    proto.remove = function (item) {
        var index = this.indexOf(item);
        if (index !== -1) {
            this.splice(index, 1);
            return true;
        }
        return false;
    };

    proto.toggle = function (item) {
        var index = this.indexOf(item);
        if (index === -1) {
            this.push(item);
            return true;
        } else {
            this.splice(index, 1);
            return false;
        }
    };

    proto.has = function (item) {
        return this.indexOf(item) !== -1;
    };

    proto.find = function (func, alt) {
        var self = Object(this);
        var len = self.length;

        for (var i = 0; i < len; i += 1) {
            if (i in self && func.call(alt, self[i], i, self)) {
                return self[i];
            }
        }
    };


    ["forEach", "indexOf", "reduce", "slice"].forEach(function (key) {
        if (typeof Array[key] !== "function") {
            Array[key] = function (array) {
                var args = proto.slice.call(arguments, 1);
                return proto[key].apply(array, args);
            };
        }
    });
}());
