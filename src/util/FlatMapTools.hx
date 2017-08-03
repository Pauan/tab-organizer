import haxe.macro.Expr;

using haxe.macro.ExprTools;
using Lambda;

typedef FlatMap<A> = {
    function wrap(): FlatMap<A>;

    function map<B>(fn: A -> B): FlatMap<B>;

    function flatten(value: FlatMap<FlatMap<A>>): FlatMap<A>;
}

class FlatMapTools {
    static private function convert(x: Expr): Expr {
        return switch (x) {
            case { expr: EFunction(_, _) }:
                x;

            case { expr: EReturn(expr) }:
                macro $expr.wrap();

            case expr:
                expr.map(convert);
        }
    }

    static public macro function flatMap(block: Expr) {
        return switch (block) {
            case { expr: EBlock(exprs) }: {
                var last = convert(exprs.pop());

                // TODO make this faster ?
                exprs.reverse();

                exprs.fold(function (left, right) {
                    return switch (left.expr) {
                        case EVars(exprs):
                            // TODO make this faster ?
                            exprs.reverse();

                            exprs.fold(function (left, right) {
                                return switch (left) {
                                    case { name: name, expr: left }:
                                        var expr = convert(left);

                                        macro $expr.map(function ($name) return $right).flatten();

                                    default:
                                        throw 'Invalid $left';
                                }
                            }, right);

                        default:
                            var expr = convert(left);

                            // TODO use a proper anonymous variable here
                            macro $expr.map(function (_) return $right).flatten();
                    }
                }, last);
            }

            default:
                throw 'Invalid $block';
        }
    }
}
