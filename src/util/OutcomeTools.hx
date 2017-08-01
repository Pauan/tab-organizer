using NothingTools;


enum Outcome<A, E> {
    Success(value: A);
    Failure(error: E);
}


class OutcomeTools {
    public static function tryFunctionVoid<A>(fn: Void -> Void): Outcome<Nothing, Error> {
        try {
            fn();
            return Success(Nothing);
        } catch (e: Dynamic) {
            return Failure(e);
        }
    }

    public static function tryFunction0<A>(fn: Void -> A): Outcome<A, Error> {
        try {
            return Success(fn());
        } catch (e: Dynamic) {
            return Failure(e);
        }
    }

    public static function tryFunction1<A, B>(fn: A -> B, a: A): Outcome<B, Error> {
        try {
            return Success(fn(a));
        } catch (e: Dynamic) {
            return Failure(e);
        }
    }

    public static function tryFunction2<A, B, C>(fn: A -> B -> C, a: A, b: B): Outcome<C, Error> {
        try {
            return Success(fn(a, b));
        } catch (e: Dynamic) {
            return Failure(e);
        }
    }

    // TODO should this be inline ?
    public static inline function map<A, B, E>(value: Outcome<A, E>, fn: A -> B): Outcome<B, E> {
        switch (value) {
        case Success(a):
            return Success(fn(a));
        case Failure(a):
            // TODO inefficient
            return Failure(a);
        }
    }
}
