package server;

import util.FlatMapTools.flatMap;
import util.MapTools.map;
using util.AsyncTools;
using util.OptionTools;
using util.NothingTools;
using util.IterableTools;

class Server {
    static function main() {
        #if run_tests
            util.TestTools.runTests([
                new util.EventDispatcher_Test()
            ]);
        #end
    }
}
