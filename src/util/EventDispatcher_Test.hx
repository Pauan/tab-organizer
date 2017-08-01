import TestTools.assert;

using ArrayTools;
using NothingTools;
using AsyncTools;
using IntTools;

class EventDispatcher_Test implements TestTools.ITest {
    private static function testEvents<A>(expected: Array<A>, isEqual: A -> A -> Bool, fn: EventDispatcher<A> -> Async<Nothing>): Async<Nothing> {
        var events = new EventDispatcher();

        assert(!events.hasReceivers());

        var output = [];

        var disposer = events.receive(output.push);

        assert(events.hasReceivers());

        return fn(events).map(function (x) {
            disposer.dispose();

            assert(!events.hasReceivers());

            assert(output.isEqual(expected, isEqual));

            return x;
        });
    }

    public function new() {}

    @sync static function test() {
        assert(true);
    }

    @async static function test2() {
        return testEvents([1, 2, 3], IntTools.isEqual, function (events) {
            events.send(1);
            events.send(2);
            events.send(3);
            return Nothing.async();
        });
    }
}
