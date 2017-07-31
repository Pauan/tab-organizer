import Outcome;

using AsyncTools;


class TestTools {
    public static inline function assert(test: Bool, ?pos: haxe.PosInfos): Void {
        if (!test) {
            throw new js.Error(pos.fileName + ":" + pos.lineNumber + ": Assertion failed");
        }
    }
}
