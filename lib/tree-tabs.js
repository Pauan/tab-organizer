/*global state */

(function () {
    "use strict";

    var indent = state.indent;

    var focusedByID = {};

    function make(tab) {
        var index = tab.window.index;

        if (!indent[index]) {
            indent[index] = [];
        }
        return indent[index];
    }

    function insert(tab, index) {
        var level = make(tab);

        index = (index < 1 ? null : level[index]);

        level.splice(tab.index, 0, index);

        Platform.event.trigger("tab-indent", tab, index);
    }

    function sub(level, list, value, i) {
        for (i; i < level.length; i += 1) {
            if (!level[i] || level[i] <= value) {
                break;
            }

            level[i] -= 1;

            if (level[i] === 0) {
                delete level[i];
            }

            Platform.event.trigger("tab-indent", list[i], level[i]);
        }
    }

    function moveup(tab, index) {
        var level = indent[tab.window.index];
        if (level) {
            var parent = level[index - 1],
                value = level[index];

            level.splice(index, 1);

            if (index === 0 || value > (parent || 0)) {
                sub(level, tab.window.tabs, value, index);
            }
        }
    }

    function equals(string) {
        for (var i = 1; i < arguments.length; i += 1) {
            if (string === arguments[i]) {
                return true;
            }
        }
    }

    function check(tab, focused) {
        if (tab.index !== 0 && tab.index !== focused.index) {
            Platform.history.lastVisit(tab.url, function (visit) {
                if (equals(visit.transition, "link", "reload", "auto_bookmark")) {
                    var level = make(tab);

                    if (level.length < tab.index) {
                        level.length = tab.index;
                    }

                    level.splice(tab.index, 0, null);

                    var amount = level[focused.index] + 1 || 1,
                        parent = level[tab.index - 1] || 0;
//!                            var reload = visit.transition === "reload";
                    if (amount - 1 > parent || /*!(reload && */amount < parent) { //* 2+ levels deep
                        amount = parent + 1;
                    }

                    level[tab.index] = amount;

                    Platform.event.trigger("tab-indent", tab, amount);
                }
            });
        }
    }


    indent.sub = function (tab) {
        var level = indent[tab.window.index];
        if (level) {
            var index = tab.index;

            if (level[index]) {
                sub(level, tab.window.tabs, level[index], index + 1);

                Platform.event.trigger("tab-indent", tab, level[index] -= 1);
            }
        }
    };

    indent.add = function (tab) {
        var index = tab.index;
        if (index === 0) {
            return;
        }

        var i, level = make(tab);

        var list = tab.window.tabs;
        var value = level[index];

        if (value && value > (level[index - 1] || 0)) {
            var prev, curr;

            for (i = index - 1; i > 0; i -= 1) {
                prev = level[i - 1],
                curr = level[i];

                if ((prev || 0) >= (curr || 0)) {
                    for (i; i <= index; i += 1) {
                        level[i] = level[i] + 1 || 1;
                        Platform.event.trigger("tab-indent", list[i], level[i]);
                    }
                    break;
                }
            }
        } else {
            for (i = index + 1; i < level.length; i += 1) {
                if (!level[i] || level[i] <= value) {
                    break;
                }

                Platform.event.trigger("tab-indent", list[i], level[i] += 1);
            }

            level[index] = value + 1 || 1;

            Platform.event.trigger("tab-indent", tab, level[index]);
        }
    };


    Platform.event.on("window-remove", function (win) {
        indent.splice(win.index, 1);
    });

    Platform.event.on("tab-move", function (tab, info) {
        moveup(tab, info.fromIndex);
        insert(tab, tab.index - 1);
    });

    Platform.event.on("tab-detach", function (tab) {
        moveup(tab, tab.index);

        Platform.event.trigger("tab-indent", tab);
    });

    Platform.event.on("tab-attach", function (tab) {
        insert(tab, tab.index - 1);

    });

    Platform.event.on("tab-remove", function (tab) {
        moveup(tab, tab.index);
    });

    Platform.event.on("tab-update", function (tab) {
        var focused = focusedByID[tab.id];
        if (focused) {
            check(tab, focused);
            delete focusedByID[tab.id];
        }
    });

    Platform.event.on("tab-create", function (tab) {
        var focused = Platform.tabs.getSelected(tab.windowId);
        if (focused) {
            if (tab.url) {
                check(tab, focused);
            } else {
                focusedByID[tab.id] = focused;
            }
        }
    });
}());
