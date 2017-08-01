import haxe.macro.Expr;
import haxe.macro.Context;
using haxe.macro.Tools;
using ArrayTools;


#if !macro
import Error;

using AsyncTools;
using NothingTools;
using OutcomeTools;

@:autoBuild(TestTools.build())
interface ITest {
    var __tests__: Array<Async<Nothing>>;
}
#end


class TestTools {
    static public macro function build(): Array<Field> {
        var fields = [];

        var tests = [];

        for (field in Context.getBuildFields()) {
            switch (field.kind) {
            case FFun(f):
                var meta = field.meta;

                // TODO throw an error or give a warning if sync/async is used incorrectly ?
                // TODO warning/error if the function is not static
                if (f.args.length == 0 && meta.length == 1) {
                    if (meta[0].name == "sync") {
                        // TODO the `clear` implementation is probably wrong
                        meta.clear();
                        tests.push(macro @:pos(field.pos) AsyncTools.asyncFunctionVoid($i{field.name}));

                    } else if (meta[0].name == "async") {
                        // TODO the `clear` implementation is probably wrong
                        meta.clear();
                        tests.push(macro @:pos(field.pos) AsyncTools.flatten(AsyncTools.asyncFunction($i{field.name})));
                    }
                }
            default:
            }

            fields.push(field);
        }

        // TODO hacky
        var field = (macro class { public var __tests__ = $a{tests}; }).fields[0];
        fields.push(field);

        return fields;
    }

    static public macro function assert(expr: ExprOf<Bool>) {
        var pos = Context.currentPos();

        // TODO a bit hacky
        var outer = macro @:pos(pos) assert(${expr});

        var str = macro @:pos(pos) $v{outer.toString()};

        return macro @:pos(pos) TestTools.assert_string(${expr}, ${str});
    }

    #if !macro
    public static inline function assert_string(test: Bool, description: String, ?pos: haxe.PosInfos): Void {
        if (!test) {
            throw new Error(pos.fileName + ":" + pos.lineNumber + ": " + description);
        }
    }

    public static function runTests(tests: Array<ITest>): Void {
        var asyncs: Array<Async<Nothing>> = [];

        for (test in tests) {
            for (async in test.__tests__) {
                asyncs.push(async);
            }
        }

        asyncs.concurrent().run(function (a) {
            switch (a) {
            case Success(a):
                // TODO better logging system
                trace(a.length + " tests succeeded");

            case Failure(a):
                throw a;
            }
        });
    }
    #end
}
