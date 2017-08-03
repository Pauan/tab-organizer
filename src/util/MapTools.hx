import haxe.macro.Context;
import haxe.macro.Expr;
import PairTools.Pair;

using haxe.macro.ExprTools;
using Lambda;
using TreeTools;

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
    static private function pairNames1(root: String, tree: Tree<Var>, out: Array<Var>, apply: Expr -> Expr): Void {
        switch (tree) {
        case Leaf(x):
            out.push({
                name: x.name,
                expr: apply(macro $i{root}),
                type: x.type
            });

        case Branch(left, right):
            pairNames1(root, left, out, function (x) {
                return macro ${apply(x)}.left;
            });

            pairNames1(root, right, out, function (x) {
                return macro ${apply(x)}.right;
            });
        }
    }

    static private inline function pairNames(root: String, tree: Tree<Var>, out: Array<Var>): Void {
        pairNames1(root, tree, out, function (a) return a);
    }


    static private function pairMap2(tree: Tree<Var>): Expr {
        switch (tree) {
        case Leaf(value):
            return value.expr;

        case Branch(left, right):
            return macro ${pairMap2(left)}.map2(${pairMap2(right)}, PairTools.pair);
        }
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
                    var tree: Tree<Var> = vars.fromArray();

                    switch (tree) {
                    // This is for 1 argument map
                    case Leaf({ name: name, expr: expr, type: type }):
                        macro $expr.map(function ($name: $type) return $body);

                    case Branch(left, right):
                        var l = pairMap2(left);
                        var r = pairMap2(right);

                        var names: Array<Var> = [];

                        // TODO use proper gensyms
                        var lName = "___u1___";
                        var rName = "___u2___";

                        var lType = null;
                        var rType = null;

                        switch (left) {
                        case Leaf({ name: name, type: type }):
                            lName = name;
                            lType = type;
                        default:
                            pairNames(lName, left, names);
                        }

                        switch (right) {
                        case Leaf({ name: name, type: type }):
                            rName = name;
                            rType = type;
                        default:
                            pairNames(rName, right, names);
                        }

                        if (names.length == 0) {
                            macro $l.map2($r, function ($lName: $lType, $rName: $rType) return $body);

                        } else {
                            var assigns: Expr = {
                                expr: EVars(names),
                                pos: Context.currentPos() // TODO better pos ?
                            };

                            macro $l.map2($r, function ($lName: $lType, $rName: $rType) {
                                ${assigns}
                                return $body;
                            });
                        }
                    }
                }
            }

            default:
                throw 'Invalid $block';
        }
    }
}
