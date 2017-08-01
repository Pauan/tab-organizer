class Server {
    static function main() {
        #if run_tests
            TestTools.runTests([
                new EventDispatcher_Test()
            ]);
        #end
    }
}
