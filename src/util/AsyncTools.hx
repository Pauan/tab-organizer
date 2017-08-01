import haxe.ds.Either;
import haxe.ds.Option;
import TestTools.assert;
import PairTools.pair;

using DisposerTools;
using OutcomeTools;
using ArrayTools;
using NothingTools;


interface IAsync<T> extends IDisposer {
    function get(fn: Outcome<T, Error> -> Void): Void;
}


abstract Async<T>(Void -> IAsync<T>) {
    public inline function new(v: Void -> IAsync<T>) {
        this = v;
    }

    public inline function run(fn: Outcome<T, Error> -> Void): Disposer {
        var async = this();
        async.get(fn);
        return async;
    }

    /*@:from
    public static inline function fromValue<T>(value: T): Async<T> {
        var v = new AsyncValue(Success(value));
        return new Async(function () return v);
    }*/
}


private class AsyncValue<T> implements IAsync<T> {
    private var value: Outcome<T, Error>;

    public inline function new(a: Outcome<T, Error>) {
        value = a;
    }

    public inline function get(fn: Outcome<T, Error> -> Void): Void {
        return fn(value);
    }

    public inline function dispose(): Void {}
}


private interface IAsyncDispatcher<T> {
    function set(a: Outcome<T, Error>): Void;
    function success(a: T): Void;
    function error(a: Error): Void;
}

class AsyncDispatcher<T> implements IAsyncDispatcher<T> implements IAsync<T> {
    private var value: Outcome<T, Error>;
    private var pending: Array<Outcome<T, Error> -> Void> = [];
    private var onCancel: Disposer;

    public function new(fn: IAsyncDispatcher<T> -> Disposer) {
        onCancel = fn(this);

        assert(onCancel != null);
    }

    // TODO this is not exception safe if the pending callbacks throw an exception
    public function set(a: Outcome<T, Error>): Void {
        assert(value == null);

        if (onCancel == null) {
            assert(pending == null);

            switch (a) {
            case Failure(a):
                throw a;
            default:
            }

        } else {
            assert(pending != null);

            var array = pending;

            value = a;
            pending = null;

            for (f in new FixedArrayIterator(array)) {
                f(a);
            }
        }
    }

    public inline function success(a: T): Void {
        return set(Success(a));
    }

    public inline function error(a: Error): Void {
        return set(Failure(a));
    }

    public function get(fn: Outcome<T, Error> -> Void): Void {
        assert(onCancel != null);

        if (pending == null) {
            fn(value);

        } else {
            pending.push(fn);
        }
    }

    public function dispose(): Void {
        assert(onCancel != null);

        var fn = onCancel;

        onCancel = null;

        if (pending == null) {
            value = null;

        } else {
            assert(value == null);

            pending = null;

            return fn.dispose();
        }
    }
}


class AsyncTools {
    public static inline function async<T>(value: T): Async<T> {
        return asyncOutcome(Success(value));
    }

    public static inline function asyncOutcome<A>(input: Outcome<A, Error>): Async<A> {
        var x = new AsyncValue(input);
        return new Async(function () return x);
    }


    public static inline function asyncFunction<A>(fn: Void -> A): Async<A> {
        return new Async(function () {
            return new AsyncValue(fn.tryFunction0());
        });
    }


    public static inline function asyncFunctionVoid<A>(fn: Void -> Void): Async<Nothing> {
        return new Async(function () {
            return new AsyncValue(fn.tryFunctionVoid());
        });
    }


    public static function map<A, B>(input: Async<A>, fn: A -> B): Async<B> {
        return new Async(function () {
            return new AsyncDispatcher(function (out) {
                return input.run(function (a) {
                    switch (a) {
                    case Success(a):
                        out.set(fn.tryFunction1(a));

                    case Failure(a):
                        out.error(a);
                    }
                });
            });
        });
    }


    public static function flatten<A>(async: Async<Async<A>>): Async<A> {
        return new Async(function () {
            return new AsyncDispatcher(function (out) {
                var inner: Disposer = null;

                var outer: Disposer = async.run(function (a) {
                    switch (a) {
                    case Success(a):
                        // TODO test whether it's faster to use a closure or not
                        inner = a.run(out.set);

                    case Failure(a):
                        out.error(a);
                    }
                });

                return function () {
                    // TODO is this correct ?
                    outer.dispose();

                    // TODO should this be disposed first or second ?
                    if (inner != null) {
                        inner.dispose();
                    }
                };
            });
        });
    }


    public static inline function flatMap<A, B>(async: Async<A>, fn: A -> Async<B>): Async<B> {
        return flatten(map(async, fn));
    }


    public static function concurrent<A>(input: Array<Async<A>>): Async<Array<A>> {
        return new Async(function () {
            return new AsyncDispatcher(function (out) {
                // TODO use a Vector instead ?
                var disposers: Array<Disposer> = new Array();
                var values: Array<A> = new Array();

                var failed: Bool = false;

                var pending: Int = input.length;

                var index: Int = 0;

                for (async in new FixedArrayIterator(input)) {
                    assert(!failed);

                    values.push(null);

                    var i = index;

                    disposers.push(async.run(function (a) {
                        assert(!failed);

                        --pending;

                        switch (a) {
                        case Success(b):
                            values[i] = b;

                            if (pending == 0) {
                                out.success(values);
                            }

                        case Failure(b):
                            failed = true;

                            for (disposer in new FixedArrayIterator(disposers)) {
                                disposer.dispose();
                            }

                            out.error(b);
                        }
                    }));

                    if (failed) {
                        break;

                    } else {
                        ++index;
                    }
                }

                return function () {
                    for (disposer in new FixedArrayIterator(disposers)) {
                        disposer.dispose();
                    }
                };
            });
        });
    }


    public static function map2<A, B, C>(left: Async<A>, right: Async<B>, fn: A -> B -> C): Async<C> {
        return new Async(function () {
            return new AsyncDispatcher(function (out) {
                // We can't use null because the asyncs might return null
                var leftValue = None;
                var rightValue = None;

                var failed = false;

                var rightDisposer: Disposer = null;

                var leftDisposer: Disposer = left.run(function (a) {
                    switch (a) {
                    case Success(a):
                        switch (rightValue) {
                        case Some(b):
                            out.set(fn.tryFunction2(a, b));
                        case None:
                            leftValue = Some(a);
                        }
                    case Failure(a):
                        failed = true;

                        if (rightDisposer != null) {
                            rightDisposer.dispose();
                        }

                        out.error(a);
                    }
                });

                if (!failed) {
                    rightDisposer = right.run(function (a) {
                        switch (a) {
                        case Success(b):
                            switch (leftValue) {
                            case Some(a):
                                out.set(fn.tryFunction2(a, b));
                            case None:
                                rightValue = Some(b);
                            }
                        case Failure(a):
                            leftDisposer.dispose();
                            out.error(a);
                        }
                    });
                }

                return function () {
                    leftDisposer.dispose();

                    if (rightDisposer != null) {
                        rightDisposer.dispose();
                    }
                };
            });
        });
    }


    public static inline function map3<A, B, C, D>(a: Async<A>, b: Async<B>, c: Async<C>, fn: A -> B -> C -> D): Async<D> {
        return map2(map2(a, b, pair), c, function (a, b) {
            return fn(a.left, a.right, b);
        });
    }


    public static function fastest<A, B>(left: Async<A>, right: Async<B>): Async<Either<A, B>> {
        return new Async(function () {
            return new AsyncDispatcher(function (out) {
                var done = false;

                var rightDisposer: Disposer = null;

                var leftDisposer: Disposer = left.run(function (a) {
                    done = true;

                    if (rightDisposer != null) {
                        rightDisposer.dispose();
                    }

                    out.set(a.map(Left));
                });

                if (!done) {
                    rightDisposer = right.run(function (a) {
                        done = true;
                        leftDisposer.dispose();
                        out.set(a.map(Right));
                    });
                }

                return function () {
                    if (!done) {
                        leftDisposer.dispose();
                        rightDisposer.dispose();
                    }
                };
            });
        });
    }
}
