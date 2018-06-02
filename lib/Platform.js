/*global chrome, KAE, Options */

var Platform = (function () {
    "use strict";

    var exists, page, Platform;

    page = chrome.extension.getBackgroundPage();

    exists = (page.Platform && typeof page.Platform === "object");

    if (exists) {
        Platform = Object.create(page.Platform);
        Platform.event = Platform.event.decouple(window);
    } else {
        Platform = {
            getURL: function (name) {
                return chrome.extension.getURL(name);
            },

            getBackgroundPage: function () {
                return chrome.extension.getBackgroundPage();
            },

            event: KAE.make.events()
        };
    }

    if (exists) {
        console.warn("Replacing with background Platform!");

        Platform.tabs.getCurrent = function (action) {
            return chrome.tabs.getCurrent(action); //!
        };

        return Platform;
    }

    var focusedByID = {},
        windowsByID = {},
        tabsByID = {};

    var windows = [];
    var lastfocused;

    function add(list, tab) {
/*!
        if (list.length < tab.index) {
            list.length = tab.index;
        }
*/
        list.splice(tab.index, 0, tab);
    }

    function update(list, i) {
        for (i; i < list.length; i += 1) {
            list[i].index = i;
        }
    }

    function assign(tab) {
        var win = windowsByID[tab.windowId];
        var list = win.tabs;

        tab.window = win;

        add(list, tab);
        update(list, tab.index);
    }

    function remove(list, tab) {
        list.splice(tab.index, 1);
    }

    function decoder(url) {
        if (url) {
            try {
                url = decodeURIComponent(url);
            } catch (e) {}

            return url;
        } else {
            return "";
        }
    }

    var location = (function () {
        var regexp = /^([^:]+)(:\/\/)([^\/]*)([^?#]*\/)([^?#\/]*)([^#]*)(#.*)?$/;

        return function (tab) {
            tab.location = {};

            var url = regexp.exec(tab.url);
            if (url) {
                tab.location.protocol = decoder(url[1]);
                tab.location.separator = decoder(url[2]);
                tab.location.domain = decoder(url[3]);
                tab.location.path = decoder(url[4]);
                tab.location.file = decoder(url[5]);
                tab.location.query = decoder(url[6]);
                tab.location.hash = decoder(url[7]);
            }
        };
    }());

    addEventListener("load", function () {
        chrome.windows.getAll({ populate: true }, function (array) {
            array.forEach(function (win, i) {
                if (win.focused) {
                    lastfocused = win;
                }
                win.index = i;

                windows.push(win);

                windowsByID[win.id] = win;

                win.tabs.forEach(function (tab) {
                    if (tab.selected) {
                        focusedByID[win.id] = tab;
                    }
                    tab.window = win;
                    location(tab);

                    tabsByID[tab.id] = tab;
                });
            });

            chrome.tabs.onCreated.addListener(function (tab) {
                assign(tab);

                location(tab);

                tabsByID[tab.id] = tab;

                Platform.event.trigger("tab-create", tab);
            });

            chrome.tabs.onUpdated.addListener(function (id, info, tab) {
                var saved = tabsByID[id];

                var old = {
                    favIconUrl: saved.favIconUrl,
                    location: saved.location,
                    pinned: saved.pinned,
                    status: saved.status,
                    title: saved.title,
                    url: saved.url
                };
/*!
                var old = {};

                ["favIconUrl", "pinned", "status", "title", "url"].forEach(function (name) {
                    if (saved[name] !== tab[name]) {
                        old[name] = saved[name];
                    }
                    saved[name] = tab[name];
                });*/

                saved.favIconUrl = tab.favIconUrl;
                saved.pinned = tab.pinned;
                saved.status = tab.status;
                saved.title = tab.title;
                saved.url = tab.url;
                location(saved);

                Platform.event.trigger("tab-update", saved, old);
            });

            chrome.tabs.onMoved.addListener(function (id, info) {
                var tab = tabsByID[id];
                var list = windowsByID[tab.windowId].tabs;

                remove(list, tab);

                tab.index = info.toIndex;
                add(list, tab);

                update(list, Math.min(info.fromIndex, info.toIndex));

                Platform.event.trigger("tab-move", tab, info);
            });

            chrome.tabs.onDetached.addListener(function (id, info) {
                var tab = tabsByID[id];
                var list = windowsByID[tab.windowId].tabs;

                tab.selected = false;
/*!
                if (focusedByID[tab.windowId] === tab) {
                    delete focusedByID[tab.windowId];
                }*/

                remove(list, tab);
                update(list, tab.index);

                Platform.event.trigger("tab-detach", tab);
            });

            chrome.tabs.onAttached.addListener(function (id, info) {
                var tab = tabsByID[id];
                tab.windowId = info.newWindowId;
                tab.index = info.newPosition;

                assign(tab);

                Platform.event.trigger("tab-attach", tab);
            });

            chrome.tabs.onSelectionChanged.addListener(function (id, info) {
                var old = focusedByID[info.windowId];
                if (old) {
                    old.selected = false;
                }

                var tab = tabsByID[id];
                tab.selected = true;

                focusedByID[info.windowId] = tab;

                Platform.event.trigger("tab-focus", tab, old);
            });

            chrome.tabs.onRemoved.addListener(function (id, info) {
                var tab = tabsByID[id];
                var list = windowsByID[tab.windowId].tabs;

                remove(list, tab);
                update(list, tab.index);
                delete tabsByID[id];

                Platform.event.trigger("tab-remove", tab);
            });


            chrome.windows.onCreated.addListener(function (win) {
                if (!win.tabs) {
                    win.tabs = [];
                }
                win.index = windows.push(win) - 1;

                windowsByID[win.id] = win;

                Platform.event.trigger("window-create", win);
            });

            chrome.windows.onFocusChanged.addListener(function (id) {
                if (id !== chrome.windows.WINDOW_ID_NONE) {
                    var old = lastfocused;
                    if (old) {
                        old.focused = false;
                    }

                    var win = windowsByID[id];
                    win.focused = true;

                    lastfocused = win;

                    Platform.event.trigger("window-focus", win, old);
                }
            });

            chrome.windows.onRemoved.addListener(function (id) {
                var win = windowsByID[id];

                remove(windows, win);
                update(windows, win.index);
                delete windowsByID[id];

                Platform.event.trigger("window-remove", win);
            });


            Platform.event.trigger("load", windows);
        });
    }, true);


/*!    [
//        "tab-update",
//        "tab-create", "tab-focus",
//        "window-focus", "window-create"
    ].forEach(function (name) {
        Platform.event.on(name, function () {
            console.warn(name);
        });
    });*/


    Platform.bookmarks = {
        getTree: function (action) {
            chrome.bookmarks.getTree(action);
        }
    };

    chrome.bookmarks.onChanged.addListener(function (id, info) {
        Platform.event.trigger("bookmark-change", id, info);
    });
    chrome.bookmarks.onCreated.addListener(function (id, bookmark) {
        Platform.event.trigger("bookmark-create", id, bookmark);
    });
    chrome.bookmarks.onRemoved.addListener(function (id, info) {
        Platform.event.trigger("bookmark-remove", id, info);
    });


    Platform.tabs = {
        getSelected: function (id) {
            return focusedByID[id];
        },

        create: function (info, action) {
            chrome.tabs.create(info, function (tab) {
                if (typeof action === "function") {
                    action(tabsByID[tab.id]);
                }
            });
        },

        remove: function (tab) {
            chrome.tabs.remove(tab.id);
        },

        update: function (tab, info) {
            chrome.tabs.update(tab.id, info);
        },

        focus: function (tab, focus) {
            chrome.tabs.update(tab.id, { selected: true });

            if (focus) {
                chrome.windows.update(tab.windowId, { focused: true });
            }
        },

        move: function (tab, info, action) {
///*
            chrome.tabs.move(tab.id, info, function (tab) {
                if (typeof action === "function") {
                    action(tabsByID[tab.id]);
                }
            });
        }
    };


    Platform.i18n = {
        get: function (name) {
            return chrome.i18n.getMessage(name);
        }
    };


    Platform.idle = {
        queryState: function (seconds, action) {
            return chrome.idle.queryState(seconds, action);
        }
    };


    Platform.message = {
        connect: function (name, action) {
            var port = chrome.extension.connect({ name: name });
            if (typeof action === "function") {
                action({
                    sendMessage: function (json) {
                        port.postMessage(json);
                    }
                });
            }
        },
        on: function (name, action) {
            chrome.extension.onConnect.addListener(function (port) {
                if (port.name === name) {
                    port.onMessage.addListener(action);
                }
            });
        }
    };


    Platform.windows = {
        get: function (id) {
            return windowsByID[id];
        },

        getFocused: function () {
            return lastfocused;
        },

        getAll: function () {
            return windows;
        },

        create: function (info, action) {
            chrome.windows.create(info, function (win) {
                if (typeof action === "function") {
                    action(windowsByID[win.id]);
                }
            });
        },

        remove: function (win) {
            chrome.windows.remove(win.id);
        },

        update: function (win, info) {
            chrome.windows.update(win.id, info);
        }
    };


    Platform.icon = {
        setBackgroundColor: function (info) {
            chrome.browserAction.setBadgeBackgroundColor(info);
        },

        setText: function (info) {
            chrome.browserAction.setBadgeText({ text: info.text + "" });
        },

        setPopup: function (info) {
            chrome.browserAction.setPopup(info);
        },

        setTitle: function (info) {
            chrome.browserAction.setTitle(info);
        }
    };

    chrome.browserAction.onClicked.addListener(function (tab) {
        Platform.event.trigger("icon-click", tab);
    });


    Platform.history = {
        lastVisit: function (url, action) {
            chrome.history.getVisits({ url: url }, function (visits) {
                var visit = visits[visits.length - 1];
                if (visit) {
                    action(visit);
                }
            });
        }
    };

    return Platform;
}());
