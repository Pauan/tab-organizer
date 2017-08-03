package util;


class ArrayTools {
    public static inline function clear<T>(array: Array<T>): Void {
        // TODO hacky
        // TODO verify that this is type safe and that it doesn't interfere with DCE
        (array: Dynamic).length = 0;
    }


    public static function isEqual<A>(left: Array<A>, right: Array<A>, isEqual: A -> A -> Bool): Bool {
        var length = left.length;

        if (length == right.length) {
            for (i in 0...length) {
                if (!isEqual(left[i], right[i])) {
                    return false;
                }
            }

            return true;

        } else {
            return false;
        }
    }
}
