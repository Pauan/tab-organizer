/*global Undo */

(function () {
    "use strict";

    Undo.setHook("move-tabs", function (info) {
        if (info.list.length) {
            state.last.moved = info.list;
        }
    });

    Undo.setHook("macro-trigger", function (info) {
        if (info.moved.length) {
            state.last.moved = info.moved;
        }
    });

    Undo.setHook("rename-window", function (info) {
        state.search();
    });


    Undo.setRule("new-tab", function (info) {
        Platform.tabs.remove(info.tab);
        Undo.reset();
    });

    Undo.setRule("rename-window", function (info) {
        info.window.title = info.value;
        info.node.select();
        Undo.reset();
    });

    Undo.setRule("select-tabs", function (info) {
        info.list.forEach(function (item) {
            if (item.undoState.selected) {
                item.queueAdd();
            } else {
                item.queueRemove();
            }
        });

        delete info.queue.shiftNode;

        Undo.reset();
    });

    Undo.setRule("favorite-tabs", function (info) {
        info.queue.forEach(function (item) {
            item.queueAdd();
        });

        info.list.forEach(function (item) {
            var url = item.tab.url;
            if (item.undoState.favorited) {
                state.favorites.set(url, state.tabsByURL[url].length);
            } else {
                state.favorites.set(url, null);
            }
        });

        Undo.reset();
    });

    Undo.setRule("pin-tabs", function (info) {
        var func = (info.type === "unpin"
                     ? info.list.forEach
                     : info.list.rightForEach);

        info.queue.forEach(function (item) {
//            console.log(item);
//            item.setAttribute("data-selected", "");
            item.queueAdd();
        });

        func.call(info.list, function (item) {
//            item.setAttribute("data-selected", "");
//
            if (item.undoState.pinned) {
                Platform.tabs.update(item.tab, { pinned: true });
            } else {
                Platform.tabs.update(item.tab, { pinned: false });
            }
        });

        Undo.reset();
    });

    function move(info) {
        var proxy = {};
        var length = info.list.length - 1;

        info.list.forEach(function (item, i) {
            Queue.sync(function (queue) {
                var undo = item.undoState;
                var info = {
                    index: undo.index
                };

                var tab = item.tab;
                if (tab.windowId === undo.windowId && tab.index < info.index) {
                    info.index += length - i;
                }

                if (state.windows[undo.windowId]) {
                    info.windowId = undo.windowId;
                } else {
                    info.windowId = proxy[undo.windowId];
                }

                function reindent(tab) {
                    var level = state.indent[tab.window.index];
                    if (level) {
                        level[tab.index] = undo.indentLevel;
                        Platform.event.trigger("tab-indent", tab, level[tab.index]);
                    }

                    item.queueAdd();
                }

                if (info.windowId) {
                    Tab.move(item, info, reindent);
                    queue.next();
                } else {
                    Window.create(null, {
                        title: undo.windowName,
                        action: function (win) {
                            info.windowId = proxy[undo.windowId] = win.id;
                            Tab.move(item, info, reindent);
                            queue.next();
                        }
                    });
                }
            });
        });
        Undo.reset();
    }

    Undo.setRule("move-tabs", move);
    Undo.setRule("macro-trigger", function (info) {
        info.list = info.moved;
        move(info);
    });
}());
