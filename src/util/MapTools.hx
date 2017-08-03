import haxe.macro.Expr;
import PairTools.Pair;

using haxe.macro.ExprTools;
using Lambda;

enum Tree<A> {
    Leaf(value: A);
    Branch(left: Tree<A>, right: Tree<A>);
}

/*
[a]                      => a
[a, b]                   => pair(a, b)
[a, b, c]                => pair(a, pair(b, c))
[a, b, c, d]             => pair(pair(a, b), pair(c, d))
[a, b, c, d, e]          => pair(pair(a, b), pair(c, pair(d, e)))
[a, b, c, d, e, f]       => pair(pair(a, pair(b, c)), pair(d, pair(e, f)))
[a, b, c, d, e, f, g]    => pair(pair(a, pair(b, c)), pair(pair(d, e), pair(f, g)))
[a, b, c, d, e, f, g, h] => pair(pair(pair(a, b), pair(c, d)), pair(pair(e, f), pair(g, h)))


[a]                      => var a = ___u1___;
[a, b]                   => var a = ___u1___.left;
                            var b = ___u1___.right;
[a, b, c]                => var a = ___u1___.left;
                            var b = ___u1___.right.left;
                            var c = ___u1___.right.right;
[a, b, c, d]             => var a = ___u1___.left.left;
                            var b = ___u1___.left.right;
                            var c = ___u1___.right.left;
                            var d = ___u1___.right.right;
[a, b, c, d, e]          => var a = ___u1___.left.left;
                            var b = ___u1___.left.right;
                            var c = ___u1___.right.left;
                            var d = ___u1___.right.right.left;
                            var e = ___u1___.right.right.right;
[a, b, c, d, e, f]       => var a = ___u1___.left.left;
                            var b = ___u1___.left.right.left;
                            var c = ___u1___.left.right.right;
                            var d = ___u1___.right.left;
                            var e = ___u1___.right.right.left;
                            var f = ___u1___.right.right.right;
[a, b, c, d, e, f, g]    => var a = ___u1___.left.left;
                            var b = ___u1___.left.right.left;
                            var c = ___u1___.left.right.right;
                            var d = ___u1___.right.left.left;
                            var e = ___u1___.right.left.right;
                            var f = ___u1___.right.right.left;
                            var g = ___u1___.right.right.right;
[a, b, c, d, e, f, g, h] => var a = ___u1___.left.left.left;
                            var b = ___u1___.left.left.right;
                            var c = ___u1___.left.right.left;
                            var d = ___u1___.left.right.right;
                            var e = ___u1___.right.left.left;
                            var f = ___u1___.right.left.right;
                            var g = ___u1___.right.right.left;
                            var h = ___u1___.right.right.right;
*/
class MapTools {
    static private function pairNames(names: Array<String>): Array<Expr> {
        // TODO pretty hacky
        var exprs = binaryMap(names, function (a) {
            return {
                name: a,
                // TODO proper support for gensyms
                expr: macro ___u1___
            };
        }, function (a) {
            return {
                name: a.name,
                expr: macro ${a.expr}.left
            };
        }, function (a) {
            return {
                name: a.name,
                expr: macro ${a.expr}.right
            };
        });

        return [for (x in exprs) {
            var name = x.name;
            var expr = x.expr;
            macro var $name = $expr;
        }];
    }


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

    private static inline function fromArray<A>(array: Array<A>): Tree<A> {
        return fromArray1(array, 0, array.length);
    }


    private static function binaryFold1<A>(a: Array<A>, start: Int, end: Int, fn: A -> A -> Bool -> A): A {
        if (end == start) {
            throw 'Array cannot be empty';

        } else if (end - start == 1) {
            return a[start];

        } else {
            // TODO use `(start + end) >> 1` instead ?
            var middle = Math.floor((start + end) / 2);
            var left = binaryFold1(a, start, middle, fn);
            var right = binaryFold1(a, middle, end, fn);
            trace(start, middle, end, a.length);
            return fn(left, right, false);
        }
    }

    // TODO this is a useful generic utility
    private static function binaryFold<A>(a: Array<A>, fn: A -> A -> Bool -> A): A {
        return binaryFold1(a, 0, a.length, fn);
    }


    private static function binaryMap1<A, B>(array: Array<A>, start: Int, end: Int, leaf: A -> B, left: B -> B, right: B -> B, apply: B -> B, out: Array<B>): Void {
        if (end == start) {
            throw 'Array cannot be empty';

        } else if (end - start == 1) {
            out.push(apply(leaf(array[start])));

        } else {
            // TODO use `(start + end) >> 1` instead ?
            var middle = Math.floor((start + end) / 2);

            binaryMap1(array, start, middle, leaf, left, right, function (a) {
                return left(apply(a));
            }, out);

            binaryMap1(array, middle, end, leaf, left, right, function (a) {
                return right(apply(a));
            }, out);
        }
    }

    // TODO this is a useful generic utility
    private static function binaryMap<A, B>(array: Array<A>, leaf: A -> B, left: B -> B, right: B -> B): Array<B> {
        var out = [];

        binaryMap1(array, 0, array.length, leaf, left, right, function (a) {
            return a;
        }, out);

        return out;
    }


    static public macro function map(block: Expr) {
        return switch (block) {
            case { expr: EBlock(exprs) }: {
                var body = exprs.pop();

                var vars = [];

                for (expr in exprs) {
                    switch (expr) {
                        case { expr: EVars(exprs) }: {
                            for (expr in exprs) {
                                vars.push(expr);
                            }
                        }

                        default:
                            throw 'Invalid $expr';
                    }
                }

                if (vars.empty()) {
                    throw "Must have one or more var, and a body";

                } else {
                    var varExprs: Array<Expr> = vars.map(function (x) {
                        return x.expr;
                    });

                    var last = vars.pop();

                    var lastName = last.name;

                    // This is for 1 argument map
                    if (vars.empty()) {
                        return macro ${last.expr}.map(function ($lastName) return $body);

                    // This is for 2+ argument map
                    } else {
                        var names: Array<String> = vars.map(function (x) {
                            return x.name;
                        });

                        var nameAssigns: Array<Expr> = pairNames(names);

                        return binaryFold(varExprs, function (left, right, isLast) {
                            if (isLast) {
                                // TODO proper support for gensyms
                                return macro $left.map2($right, function (___u1___, $lastName) {
                                    $a{nameAssigns};
                                    return $body;
                                });

                            } else {
                                return macro $left.map2($right, PairTools.pair);
                            }
                        });
                    }
                }
            }

            default:
                throw 'Invalid $block';
        }
    }
}
