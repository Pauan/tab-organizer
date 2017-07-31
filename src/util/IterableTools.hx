@:generic
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


@:generic
class MapIterator<A, B> {
    private var iterator: Iterator<A>;
    private var fn: A -> B;

    public inline function new(iterator, fn) {
        this.iterator = iterator;
        this.fn = fn;
    }

    public inline function hasNext(): Bool {
        return iterator.hasNext();
    }

    public inline function next(): B {
        return fn(iterator.next());
    }
}


class MapIterable<A, B> {
    private var iterable: Iterable<A>;
    private var fn: A -> B;

    public inline function new(iterable, fn) {
        this.iterable = iterable;
        this.fn = fn;
    }

    public inline function iterator(): Iterator<B> {
        return new MapIterator<A, B>(iterable.iterator(), fn);
    }
}


/*class FilterIterator<A> {
    private var iterator: Iterator<A>;
    private var fn: A -> Bool;
    private var seen: Bool = false;
    private var value: A = null;

    public inline function new(iterator, fn) {
        this.iterator = iterator;
        this.fn = fn;
    }

    public inline function hasNext(): Bool {
        while (iterator.hasNext()) {
            var value = iterator.next();

            if (fn(value)) {
                seen = true;
                value = value;
                return true;
            }
        }
    }

    public inline function next(): A {
        assert(seen);
        var temp = value;
        seen = false;
        value = null;
        return temp;
    }
}


class FilterIterable<A> {
    private var iterable: Iterable<A>;
    private var fn: A -> Bool;

    public inline function new(iterable, fn) {
        this.iterable = iterable;
        this.fn = fn;
    }

    public inline function iterator(): Iterator<B> {
        return new FilterIterator<A, B>(iterable.iterator(), fn);
    }
}*/


class IterableTools {
    public static inline function map<A, B>(iterable: Iterable<A>, fn: A -> B): Iterable<B> {
        return new MapIterable<A, B>(iterable, fn);
    }

    /*public static inline function filter<A, B>(iterable: Iterable<A>, fn: A -> Bool): Iterable<A> {
        return new FilterIterable<A>(iterable, fn);
    }*/
}
