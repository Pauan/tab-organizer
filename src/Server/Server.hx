class Server {
    static function main() {
        chrome.Alarms.create("foo", {
            when: 0.0
        });
        trace("hi!");
        trace("nou");
        trace("testing");

        #if run_tests
            trace("DEBUGGING");
        #end
    }
}
