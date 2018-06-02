var KAE = Object(KAE);

KAE.array = Object(KAE.array);

KAE.array.stablesort = function (array, func) {
    "use strict";

    var result = array.slice();

    if (result.length < 2) {
        return result;
    }

    if (typeof func !== "function") {
        func = function (a, b) {
            return a - b;
        };
    }

    /** insertion sort */

    var prev, value;

    for (var i = 1; i < result.length; i += 1) {
        value = result[i];
        prev = i - 1;

        while (func(result[prev], value) > 0) {
            result[prev + 1] = result[prev];
            prev -= 1;

            if (prev < 0) {
                break;
            }
        }
        result[prev + 1] = value;
    }

    return result;
};
