class FixedArrayIterator<T> {
    private var index: Int = 0;
    private var array: Array<T>;
    private var length: Int;

    public inline function new(array) {
        this.array = array;
        this.length = array.length;
    }

    public inline function hasNext(): Bool {
        return index < length;
    }

    public inline function next(): T {
        return array[index++];
    }
}


class ArrayTools {
    // TODO this doesn't inline fully
    /*public static inline function fixedIterator<T>(array: Array<T>): Iterator<T> {
        return new FixedArrayIterator(array);
    }*/

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
