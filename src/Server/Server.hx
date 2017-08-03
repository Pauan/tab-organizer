import FlatMapTools.flatMap;
import MapTools.map;
using AsyncTools;
using OptionTools;

class Server {
    static function main() {
        var z = map({
            var a = 1.wrap();
            var b = 2.wrap();
            var c = 3.wrap();
            var d = 4.wrap();
            var e = 5.wrap();
            /*var f = 6.wrap();
            var g = 7.wrap();
            var h = 8.wrap();
            var j = 9.wrap();*/
            a;
        });

        #if run_tests
            TestTools.runTests([
                new EventDispatcher_Test()
            ]);
        #end
    }
}
