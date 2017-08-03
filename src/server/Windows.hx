enum WindowEvents {
    WindowCreated(window: Window, index: Int);
    WindowClosed(window: Window, index: Int);
    WindowFocused(window: Window);
    WindowUnfocused(window: Window);

    TabCreated(tab: Tab, window: Window, index: Int);
    TabClosed(tab: Tab, window: Window, index: Int);
    TabFocused(tab: Tab);
    TabUnfocused(tab: Tab);
    TabMovedInSameWindow(tab: Tab, window: Window, oldIndex: Int, newIndex: Int);
    TabMovedToOtherWindow(tab: Tab, oldWindow: Window, newWindow: Window, oldIndex: Int, newIndex: Int);
    TabChanged(tab: Tab);
}

class Window {
    public function new() {}
}

class Tab {
}

class Windows {
    private var pending: Array<Void -> Void> = [];

    public var events: EventDispatcher<WindowEvents> = new EventDispatcher();

    public function new() {
        var disposer = events.receive(function (a) return trace(a));

        trace(events.hasReceivers());

        events.send(WindowCreated(new Window(), 0));

        disposer.dispose();
    }
}
