import haxe.ds.Option;


class OptionTools {
    public static inline function wrap<A>(value: A): Option<A> {
        return Some(value);
    }

    public static function map<A, B>(value: Option<A>, fn: A -> B): Option<B> {
        switch (value) {
        case Some(value):
            return Some(fn(value));
        case None:
            return None;
        }
    }

    public static function map2<A, B, C>(left: Option<A>, right: Option<B>, fn: A -> B -> C): Option<C> {
        switch (left) {
        case Some(left):
            switch (right) {
            case Some(right):
                return Some(fn(left, right));
            case None:
                return None;
            }
        case None:
            return None;
        }
    }
}
