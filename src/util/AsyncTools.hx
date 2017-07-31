import Outcome;//import Outcome;
import TestTools.assert;

using ArrayTools;


interface Async<T> {
    function get(fn: T -> Void): Void;

    function cancel(): Void;
}


class AsyncValue<T> implements Async<T> {
    private var value: T;

    public inline function new(a: T) {
        value = a;
    }

    public inline function get(fn: T -> Void): Void {
        return fn(value);
    }

    public inline function cancel(): Void {}
}


class AsyncDispatcher<T> implements Async<T> {
    private var value: T;
    private var pending: Array<T -> Void> = [];
    private var onCancel: Void -> Void;

    public function new(fn: Void -> Void) {
        assert(fn != null);

        onCancel = fn;
    }

    // TODO this is not exception safe if the pending callbacks throw an exception
    public function set(a: T): Void {
        assert(pending != null);
        assert(onCancel != null);

        var array = pending;

        value = a;
        pending = null;

        for (f in array.fixedIterator()) {
            f(a);
        }
    }

    public function get(fn: T -> Void): Void {
        assert(onCancel != null);

        if (pending == null) {
            fn(value);

        } else {
            pending.push(fn);
        }
    }

    public function cancel(): Void {
        assert(onCancel != null);

        var fn = onCancel;

        onCancel = null;

        if (pending == null) {
            value = null;

        } else {
            pending = null;

            return fn();
        }
    }
}


class AsyncTools {
    public static inline function wrap<A>(v: A): Async<A> {
        return new AsyncValue(v);
    }


    public static function map<A, B>(async: Async<A>, fn: A -> B): Async<B> {
        var out = new AsyncDispatcher(async.cancel);

        async.get(function (a) {
            out.set(fn(a));
        });

        return out;
    }


    public static function flatten<A>(async: Async<Async<A>>): Async<A> {
        var inner = null;

        var out = new AsyncDispatcher(function () {
            // TODO is this correct ?
            async.cancel();

            // TODO should this be cancelled first or second ?
            if (inner != null) {
                inner.cancel();
            }
        });

        async.get(function (a) {
            inner = a;

            a.get(function (a) {
                out.set(a);
            });
        });

        return out;
    }


    public static inline function flatMap<A, B>(async: Async<A>, fn: A -> Async<B>): Async<B> {
        return flatten(map(async, fn));
    }


    public static function concurrent<A>(input: Array<Async<A>>): Async<Array<A>> {
        // TODO use a Vector instead ?
        var asyncs = new Array();
        var values = new Array();

        var pending: Int = input.length;

        var index: Int = 0;

        var out = new AsyncDispatcher(function () {
            for (async in asyncs.fixedIterator()) {
                async.cancel();
            }
        });

        for (async in input.fixedIterator()) {
            asyncs.push(async);
            values.push(null);

            var i = index;

            async.get(function (a) {
                --pending;

                values[i] = a;

                if (pending == 0) {
                    out.set(values);
                }
            });

            ++index;
        }

        return out;
    }


    public static function concurrentCancel<E, A>(input: Array<Async<Outcome<A, E>>>): Async<Outcome<Array<A>, E>> {
        // TODO use a Vector instead ?
        var asyncs = new Array();
        var values = new Array();

        var failed: Bool = false;

        var pending: Int = input.length;

        var index: Int = 0;

        var out = new AsyncDispatcher(function () {
            for (async in asyncs.fixedIterator()) {
                async.cancel();
            }
        });

        for (async in input.fixedIterator()) {
            if (failed) {
                break;

            } else {
                asyncs.push(async);
                values.push(null);

                var i = index;

                async.get(function (a) {
                    assert(!failed);

                    --pending;

                    switch (a) {
                    case Success(b):
                        values[i] = b;

                        if (pending == 0) {
                            out.set(Success(values));
                        }

                    case Failure(b):
                        failed = true;

                        for (async in asyncs.fixedIterator()) {
                            async.cancel();
                        }

                        out.set(Failure(b));
                    }
                });

                ++index;
            }
        }

        return out;
    }
}
