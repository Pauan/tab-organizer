package util;


private typedef IterableType<A> = {
    function iterator(): Iterator<A>;
}

abstract Iterable<A>(Void -> Iterator<A>) {
    public inline function new(x) {
        this = x;
    }

    public inline function iterator(): Iterator<A> {
        return this();
    }

    @:from public static inline function fromIterable<A>(from: IterableType<A>): Iterable<A> {
        return new Iterable(function () {
            return from.iterator();
        });
    }

    @:from public static inline function fromArray<A>(from: Array<A>): Iterable<A> {
        return new Iterable(function () {
            return new FixedArrayIterator(from);
        });
    }
}


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


class FlattenIterator<A> {
    private var outer: Iterator<Iterable<A>>;
    private var inner: Iterator<A> = null;

    public function new(a) {
        outer = a;
    }

    public function hasNext(): Bool {
        while (true) {
            // TODO is this safe ?
            if (inner == null) {
                if (outer.hasNext()) {
                    inner = outer.next().iterator();

                } else {
                    return false;
                }
            }

            if (inner.hasNext()) {
                return true;

            } else {
                inner = null;
            }
        }
    }

    public function next(): A {
        return inner.next();
    }
}


class ConcatIterator<A> {
    private var left: Iterator<A>;
    private var right: Iterator<A>;

    public function new(left, right) {
        this.left = left;
        this.right = right;
    }

    public function hasNext(): Bool {
        // TODO is this safe ?
        if (left != null) {
            if (left.hasNext()) {
                return true;

            } else {
                left = null;
            }
        }

        return right.hasNext();
    }

    public function next(): A {
        if (left != null) {
            return left.next();

        } else {
            return right.next();
        }
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
        return new Iterable(function () {
            return new MapIterator<A, B>(iterable.iterator(), fn);
        });
    }

    public static inline function flatten<A>(iterable: Iterable<Iterable<A>>): Iterable<A> {
        return new Iterable(function () {
            return new FlattenIterator(iterable.iterator());
        });
    }

    public static inline function concat<A>(left: Iterable<A>, right: Iterable<A>): Iterable<A> {
        return new Iterable(function () {
            // TODO initialize the right Iterable lazily
            return new ConcatIterator(left.iterator(), right.iterator());
        });
    }

    public static inline function each<A>(iterable: Iterable<A>, fn: A -> Void): Void {
        for (x in iterable) {
            fn(x);
        }
    }
}
