import FlatMapTools.flatMap;
import MapTools.map;
using AsyncTools;
using OptionTools;
using NothingTools;

class Server {
    static function main() {
        #if run_tests
            TestTools.runTests([
                new EventDispatcher_Test()
            ]);
        #end
    }
}
