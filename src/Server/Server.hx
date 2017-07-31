import Windows;


class Server {
    static function main() {
        var windows = new Windows();

        trace("hi!");
        trace("nou");
        trace("testing");

        #if run_tests
            tink.testrunner.Runner.run(TestBatch.make([
                new EventDispatcher_Test(),
            ])).handle(Runner.exit);
        #end
    }
}
