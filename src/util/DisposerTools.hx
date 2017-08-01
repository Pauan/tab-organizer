import TestTools.assert;


interface IDisposer {
    function dispose(): Void;
}


private class DisposerFunction implements IDisposer {
    private var disposer: Void -> Void;
    private var disposed: Bool = false;

    public inline function new(fn: Void -> Void) {
        disposer = fn;
    }

    public inline function dispose() {
        assert(!disposed);
        disposed = true;
        return disposer();
    }
}


abstract Disposer(IDisposer) from IDisposer to IDisposer {
    public inline function new(a) {
        this = a;
    }

    public inline function dispose(): Void {
        return this.dispose();
    }

    @:from
    public static inline function fromFunction(fn: Void -> Void): Disposer {
        return new Disposer(new DisposerFunction(fn));
    }
}
