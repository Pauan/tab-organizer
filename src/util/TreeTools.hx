package util;


enum Tree<A> {
    Leaf(value: A);
    Branch(left: Tree<A>, right: Tree<A>);
}


class TreeTools {
    private static function fromArray1<A>(array: Array<A>, start: Int, end: Int): Tree<A> {
        if (end == start) {
            throw 'Array cannot be empty';

        } else if (end - start == 1) {
            return Leaf(array[start]);

        } else {
            // TODO use `(start + end) >> 1` instead ?
            var middle = Math.floor((start + end) / 2);

            return Branch(
                fromArray1(array, start, middle),
                fromArray1(array, middle, end)
            );
        }
    }

    public static inline function fromArray<A>(array: Array<A>): Tree<A> {
        return fromArray1(array, 0, array.length);
    }


    public static function map<A, B>(tree: Tree<A>, fn: A -> B): Tree<B> {
        switch (tree) {
        case Leaf(value):
            return Leaf(fn(value));

        case Branch(left, right):
            return Branch(
                map(left, fn),
                map(right, fn)
            );
        }
    }


    public static function each<A>(tree: Tree<A>, fn: A -> Void): Void {
        switch (tree) {
        case Leaf(value):
            fn(value);

        case Branch(left, right):
            each(left, fn);
            each(right, fn);
        }
    }
}
