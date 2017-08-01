import TestTools.assert;

using DisposerTools;
using ArrayTools;
using IterableTools;


private class EventListener<T> implements IDisposer {
    private var dispatcher: EventDispatcher<T>;

    public var active: Bool = true;
    public var callback: T -> Void;

    public function new(dispatcher, callback) {
        this.dispatcher = dispatcher;
        this.callback = callback;
    }

    public function dispose(): Void {
        assert(active);

        active = false;

        if (dispatcher.sending == 0) {
            assert(dispatcher.listeners.remove(this));

        } else {
            dispatcher.killed.push(this);
        }
    }
}


@:allow(EventListener)
class EventDispatcher<T> {
    private var listeners: Array<EventListener<T>> = [];
    private var killed: Array<EventListener<T>> = [];
    private var sending: Int = 0;

    public function new() {}

    public function hasReceivers(): Bool {
        return listeners.length != 0;
    }

    public function receive(callback: T -> Void): Disposer {
        var listener = new EventListener(this, callback);
        listeners.push(listener);
        return listener;
    }

    // TODO this is not exception-safe if a callback throws an exception
    public function send(value: T): Void {
        ++sending;

        for (listener in new FixedArrayIterator(listeners)) {
            if (listener.active) {
                listener.callback(value);
            }
        }

        --sending;

        if (sending == 0 && killed.length != 0) {
            for (listener in new FixedArrayIterator(killed)) {
                assert(!listener.active); // TODO is this assert necessary ?
                assert(listeners.remove(listener));
            }

            killed.clear();
        }
    }
}
