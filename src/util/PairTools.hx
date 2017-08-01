class Pair<A, B> {
    public var left: A;
    public var right: B;

    public inline function new(left: A, right: B) {
        this.left = left;
        this.right = right;
    }
}


class PairTools {
    public static inline function pair<A, B>(a: A, b: B): Pair<A, B> {
        return new Pair(a, b);
    }
}
