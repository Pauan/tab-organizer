/*global action, events, localStorage, Options, Platform, Queue, Tab, UI, Undo, Window */
"use strict";

document.title = Platform.i18n.get("global_extension_name");

if (Options.get("popup.type") === "bubble") {
    document.body.style.width = Options.get("popup.width") + "px";
    document.body.style.height = Options.get("popup.height") + "px";
}


function sorter(info) {
    var sorters = {};

    var addHooks = {},
        remHooks = {};

    var action = {};

    function hook(name, events) {
        function fn() {
            info.sort(action, sorters[name]);
        }

        addHooks[name] = function () {
            events.forEach(function (event) {
                Platform.event.on(event, fn);
            });
        };

        remHooks[name] = function () {
            events.forEach(function (event) {
                Platform.event.remove(event, fn);
            });
        };
    }

    function reverse(func) {
        return function (a, b) {
            var n = func(a, b);
            if (n < 0) {
                return 1;
            } else if (n > 0) {
                return -1;
            }
            return n;
        };
    }

    function addtype(name, info, rev) {
        sorters[name] = (rev
                          ? reverse(info.sort)
                          : info.sort);

        if (info.hooks) {
            hook(name, info.hooks);
        }
    }

    action.type = function (name, info) {
        addtype(name + " <", info);
        addtype(name + " >", info, true);
    };

    action.rearrange = function (list, parent) {
        var fragment = document.createDocumentFragment();
//            selected = document.activeElement;
//
//        addEventListener("focus", events.stop, true);
//        addEventListener("blur", events.stop, true);

        list.forEach(function (item, i) {
//            console.log(item);
//            if (/*document.activeElement === item*/item.hasAttribute("data-selected")) {
//                selected = item;
//            }
//
//!            item.style.webkitBoxOrdinalGroup = i + 1;
//!            item.style.zIndex = i;
            fragment.appendChild(item);
        });

        parent.appendChild(fragment);
//
//        removeEventListener("focus", events.stop, true);
//        removeEventListener("blur", events.stop, true);
//
//        if (selected) {
//            selected.focus();
////            console.log(selected);
////            selected.setAttribute("data-selected", "");
//        }
    };

    action.comp = function (a, b) {
        return a.toLowerCase().localeCompare(b.toLowerCase());
    };

    info.init(action);

    return function (name) {
        var type = Options.get(info.name);
        if (remHooks[type]) {
            remHooks[type]();
        }

        if (sorters[name]) {
            if (addHooks[name]) {
                addHooks[name]();
            }

            info.sort(action, sorters[name]);
            Options.set(info.name, name);
        }
    };
}


var state = {
    event: KAE.make.events(),
    titles: Options.get("windows.titles"),
    macros: Options.get("macros.list"),
    favorites: Options.get("tabs.favorites.urls"),
    last: {},
    list: [],
    windows: {},
    bookmarksByID: {},
    bookmarksByURL: {},
    tabsByID: {},
    tabsByURL: {},
    visitedByURL: Options.get("tabs.visited.byURL"),
    indent: Options.get("windows.tab-indent"),

    createSearchList: function () {
        return Array.slice(document.getElementsByClassName("tab"));
    },

    createView: function (windows) {
        var fragment = document.createDocumentFragment();

        windows.forEach(function (win) {
//            console.log(win);
            if (win.type === "normal") {
//                if (i < 51 || i > 51) { // 28
                fragment.appendChild(Window.proxy(win));
//                }
            }
        });

        state.windowList.appendChild(fragment);
    },

    urlBar: UI.create("div", function (container) {
        container.id = "URL-bar";
        container.setAttribute("hidden", "");
        document.body.appendChild(container);
    }),

    placeholder: UI.create("div", function (container) {
        container.id = "placeholder";

        container.update = function () {
            var node = document.querySelector(".tab[data-dropindent]");
            if (node) {
                node.removeAttribute("data-dropindent");
            }
        };

        var saved = container.remove;

        container.remove = function () {
            container.update();
            saved.call(container);
        };

        container.check = function (node, sibling) {
            if (state.draggedTab) {
                var has = state.draggedTab.hasAttribute("data-selected");

                if (has) {
                    if (node && !node.hasAttribute("data-selected")) {
                        return true;
                    } else if (sibling && !sibling.hasAttribute("data-selected")) {
                        return true;
                    }
                } else if (node !== state.draggedTab && sibling !== state.draggedTab) {
                    return true;
                }
            }
        };
    }),


    sortWindows: sorter({
        name: "windows.sort.type",

        sort: function (action, func) {
            var selected = document.activeElement;

            state.sorted = KAE.array.stablesort(state.list, func);
            action.rearrange(state.sorted, state.windowList);

            if (selected/* && selected.className === "window"*/) {
                selected.focus();
            }
        },

        init: function (action) {
            action.type("date-created", {
                sort: function (a, b) {
                    return a.window.index -
                           b.window.index;
                }
//!                function () {
//!                    state.sorted = state.list;
//!                    action.rearrange(state.sorted, state.windowList);
//!                }
            });

            action.type("tab-number", {
                hooks: ["tab-create", "tab-remove", "tab-attach"],
                sort: function (a, b) {
                    return a.window.tabs.length -
                           b.window.tabs.length;
                }
            });

            action.type("name", {
                hooks: ["window-create", "window-rename"],
                sort: function (a, b) {
                    var test = a.window.title - b.window.title;

                    if (isNaN(test)) {
                        test = action.comp(a.window.title, b.window.title);
                    }

                    return test;
                }
            });
        }
    }),


    sortTabs: sorter({
        name: "tabs.sort.type",

        sort: function (action, func) {
            state.list.forEach(function (item) {
                var array = Array.slice(item.tabList.children);
                array = KAE.array.stablesort(array, func);
                action.rearrange(array, item.tabList);
            });
        },

        init: function (action) {
            action.type("index", {
                sort: function (a, b) {
                    return a.tab.index - b.tab.index;
                }
            });

            action.type("title", {
                hooks: ["tab-create", "tab-update", "tab-attach"],
                sort: function (a, b) {
                    return action.comp(a.tab.title, b.tab.title);
                }
            });

            action.type("url", {
                hooks: ["tab-create", "tab-update", "tab-attach"],
                sort: function (a, b) {
                    return action.comp(a.tab.url, b.tab.url);
                }
            });
        }
    }),
};

state.sorted = state.list;


state.tabsByURL.update = function (url) {
    if (state.favorites.has(url)) {
        state.favorites.set(url, state.tabsByURL[url].length);
    }
};

state.tabsByURL.add = function (url, node) {
    state.tabsByURL[url] = state.tabsByURL[url] || [];
    state.tabsByURL[url].push(node);
    state.tabsByURL.update(url);
};

state.tabsByURL.remove = function (url, node) {
    state.tabsByURL[url].remove(node);
    state.tabsByURL.update(url);
};


if (localStorage["window.titles"]) {
    state.titles.push.apply(state.titles, Options.getObject(localStorage["window.titles"]));
    delete localStorage["window.titles"];

    state.titles.forEach(function (item, i) {
        if (+item === i + 1) {
            delete state.titles[i];
        }
    });
}


Platform.bookmarks.getTree(function recurse(array) {
    var url = state.bookmarksByURL;
    array.forEach(function (item) {
        if (item.children) {
            recurse(item.children);
        } else {
            state.bookmarksByID[item.id] = item;
            url[item.url] = url[item.url] + 1 || 1;
        }
    });

    if (state.loaded) {
        state.search();
        //! state.search({ scroll: true, focused: true, nodelay: true });
    }
});

Platform.event.on("bookmark-change", function (id, info) {
    var bookmark = state.bookmarksByID[id],
        url = state.bookmarksByURL;

    if (info.url) {
        url[bookmark.url] -= 1;
        bookmark.title = info.title;
        bookmark.url = info.url;
        url[info.url] = url[info.url] + 1 || 1;

        state.search();
    }
});

Platform.event.on("bookmark-create", function (id, bookmark) {
    var url = state.bookmarksByURL;
    if (bookmark.url) {
        state.bookmarksByID[id] = bookmark;
        url[bookmark.url] = url[bookmark.url] + 1 || 1;
        state.search({ tabs: state.tabsByURL[bookmark.url] });
    }
});

Platform.event.on("bookmark-remove", function (id, info) {
    var bookmark = state.bookmarksByID[id];
    if (bookmark) {
        state.bookmarksByURL[bookmark.url] -= 1;
        delete state.bookmarksByID[id];
        state.search({ tabs: state.tabsByURL[bookmark.url] });
    }
});


addEventListener("dragstart", function () {
    state.dragging = true;
}, true);

addEventListener("dragover", function (event) {
    if (!event.defaultPrevented) {
        document.activeElement.blur();
        state.placeholder.remove();
    }
}, false);

addEventListener("dragend", function () {
    state.placeholder.remove();
    state.dragging = false;
}, true);



function findVisible(x, name) {
    x = x[name];
    if (x) {
        if (x.hasAttribute("hidden")) {
            return findVisible(x, name);
        } else {
            return x;
        }
    }
}


function findVertical(x, name, num) {
    var y = findVisible(x, name);
    if (y) {
        if (y.offsetLeft !== num) {
            return findVertical(y, name, num);
        } else {
            return y;
        }
    }
}


addEventListener("keydown", function (event) {
    if (event.which === 27) { //* Escape
        if (!event.defaultPrevented) {
            if (Options.get("popup.close.escape")) {
                close();
            }
        }
    } else if (event.ctrlKey || event.metaKey) {
        if (event.which === 38) { //* Up
            if (Options.get("windows.type") === "grid") {
                var elem = document.querySelector(".window[data-focused]"),
                    next = findVertical(elem, "previousSibling", elem.offsetLeft);
                /*    num  = Options.get("windows.grid.columns");

                elem = state.sorted[state.sorted.indexOf(elem) - num];*/

                //console.log("up", elem, next);

                if (next) {
                    next.setWindowFocus();
                    next.tabList.focus();
                }
            }

            event.preventDefault();
        } else if (event.which === 40) { //* Down
            if (Options.get("windows.type") === "grid") {
                var elem = document.querySelector(".window[data-focused]"),
                    next = findVertical(elem, "nextSibling", elem.offsetLeft);
                /*    num  = Options.get("windows.grid.columns");

                elem = state.sorted[state.sorted.indexOf(elem) + num];*/

                //console.log("down", elem, next);

                if (next) {
                    next.setWindowFocus();
                    next.tabList.focus();
                }
            }

            event.preventDefault();
        } else if (event.which === 37) { //* Left
            var elem = document.querySelector(".window[data-focused]"),
                next = findVisible(elem, "previousSibling");

            //console.log("left", elem.offsetTop, next.offsetTop);

            if (next && Options.get("windows.type") === "grid") {
                if (elem.offsetTop !== next.offsetTop) {
                    next = null;
                }
                /*var index = state.sorted.indexOf(elem),
                    num   = Options.get("windows.grid.columns");

                if (index % num === num - 1) {
                    elem = null;
                }*/
            }

            if (next) {
                next.setWindowFocus();
                next.tabList.focus();
            }

            event.preventDefault();
        } else if (event.which === 39) { //* Right
            var elem = document.querySelector(".window[data-focused]"),
                next = findVisible(elem, "nextSibling");

            //console.log("right", elem.offsetTop, next.offsetTop);

            if (next && Options.get("windows.type") === "grid") {
                if (elem.offsetTop !== next.offsetTop) {
                    next = null;
                }
                /*var index = state.sorted.indexOf(elem),
                    num   = Options.get("windows.grid.columns");

                if (index % num === 0) {
                    elem = null;
                }*/
            }

            if (next) {
                next.setWindowFocus();
                next.tabList.focus();
            }

            event.preventDefault();
        }
    }
}, false);


state.filterWithMacros = (function () {
    function go(macro, info) {
        var first, moved, odd, results;

        if (macro.search) {
            results = action.search(info.tabs, macro.search);

            if (results.length) {
                info.makeNew = info.makeNew.filter(function (item) {
                    return results.indexOf(item) === -1;
                });

                info.tabs = info.tabs.filter(function (item) {
                    return results.indexOf(item) === -1;
                });

                switch (macro.action) {
                case "require": //* FALLTHRU
                case "move":
                    state.search.delay(1000);

                    if (macro.window) {
                        first = state.list.find(function (item) {
                            return item.window.title === macro.window;
                        });

                        if (first) {
                            if (macro.action === "require") {
                                odd = Array.slice(first.tabList.children);

                                odd = odd.filter(function (item) {
                                    return info.tabs.indexOf(item) !== -1;
                                });

                                if (odd.length) {
                                    info.makeNew = info.makeNew.concat(odd);
                                }
                            }
//
//                                        moved = results.moveTabs(first.window, { undo: false });//!info.moved);
//
//                                        info.moved = info.moved.concat(moved);

                            results = results.filter(function (item) {
                                return item.tab.window !== first.window;
                            });

                            info.moved.push({ window: first.window, tabs: results });
                        } else {
                            info.moved.push({ title: macro.window, tabs: results });
//                                        info.moved = info.moved.concat(results);
//
//                                        Window.create(results, { title: macro.window, undo: false });
                        }
                    } else {
//                                    info.moved = info.moved.concat(results);
                        info.makeNew = info.makeNew.concat(results);
//
//                                    Window.create(results, { undo: false });
                    }
                    break;
                case "close":
                    state.search.delay(1000);

                    info.closed = info.closed.concat(results);
                }
            }
        }

        return info;
    }

    return function (array) {
        var info = {
            makeNew: [],
            closed: [],
            moved: []
        };

        info.tabs = state.createSearchList();

        array.forEach(function (item) {
            info = go(item, info);
        });

        return info;
    };
}());


var fragment = document.createDocumentFragment();

fragment.appendChild(UI.create("div", function (toolbar) {
    toolbar.id = "toolbar";

    toolbar.appendChild(UI.create("button", function (element) {
        element.id = "button-menu";
        element.className = "Options-button";
        element.title = "(Ctrl M)";
        element.textContent = Platform.i18n.get("button_toolbar_menu");
        element.tabIndex = 1;

        element.appendChild(UI.create("img", function (element) {
            element.id = "button-menu-arrow";
            element.src = "/themes/Black-button-menu.png";
        }));

        element.appendChild(UI.contextMenu(function (menu) {
            function show(event) {
                if (menu["DOM.Element"].contains(event.target)) {
                    return;
                }
                if (event.button !== 2) {
                    menu.show();
                }
            }
            element.addEventListener("mousedown", show, true);
            element.addEventListener("dragenter", show, true);
            element.addEventListener("click", show, true);

            element.addEventListener("dragenter", element.focus, true);
            element.addEventListener("dragover", events.stop, false);

            function stopPropagation() {
                function stop(event) {
                    this.removeEventListener(event.type, stop, true);
                    event.stopPropagation();
                }
                addEventListener("search", stop, true);

                setTimeout(function () {
                    removeEventListener("search", stop, true);
                }, 500);
            }

            addEventListener("keypress", function (event) {
                if (!event.defaultPrevented) {
                    if (event.which === 13 && (event.ctrlKey || event.metaKey)) {
                        if (!event.altKey && !event.shiftKey) {
                            stopPropagation(); //! hacky

                            element.focus();
                            menu.show();
                        }
                    }
                }
            }, false);


            menu.addItem(Platform.i18n.get("toolbar_menu_new_window"), {
                keys: ["N"],
                ondrop: function () {
                    Window.create(state.currentQueue);
                },
                action: function () {
                    Platform.windows.create({});
                }
            });


            menu.separator();

            var perform = function (array) {
                var info = state.filterWithMacros(array);

                state.search.delay(1000);

                if (info.makeNew.length) {
                    Window.create(info.makeNew, { undo: false });

                    info.moved = info.moved.concat(info.makeNew);
                }

                var closed = info.closed;
                var moved = [];

                closed.forEach(function (item) {
                    Platform.tabs.remove(item.tab);
                });

                info.moved.forEach(function (item) {
                    //console.log(item);
                    //state.search.delay(1000);

                    if (item.title) {
                        moved = moved.concat(item.tabs);

                        Window.create(item.tabs, { title: item.title, undo: false });
                    } else if (item.tabs) {
                        moved = moved.concat(item.tabs.moveTabs(item.window, { undo: false }));
                    }
                });

                Undo.push("macro-trigger", {
                    closed: closed,
                    moved: moved
                });

                var text = [];

                if (moved.length) {
                    text.push(Platform.i18n.get("undo_message_move"),
                              moved.length,
                              Platform.i18n.get("global_tab"));

                    if (moved.length !== 1) {
                        text.push(Platform.i18n.get("global_plural"));
                    }

//!                        text.push(" and closed ", closed.length, " tab");
//!                        if (closed.length !== 1) {
//!                            text.push("s");
//!                        }
                    text.push(Platform.i18n.get("global_end"));

                    state.undoBar.show(text.join(""));

                } else if (closed.length) {
                    text.push(Platform.i18n.get("undo_message_closed"),
                              closed.length,
                              Platform.i18n.get("global_tab"));

                    if (closed.length !== 1) {
                        text.push(Platform.i18n.get("global_plural"));
                    }

//!                        text.push(" and closed ", closed.length, " tab");
//!                        if (closed.length !== 1) {
//!                            text.push("s");
//!                        }
                    text.push(Platform.i18n.get("global_end"));

                    state.undoBar.show(text.join(""), { undo: false });

                } else {
                    state.undoBar.show(Platform.i18n.get("undo_message_noop") +
                                       Platform.i18n.get("global_end"), { undo: false });
                }
            };


            menu.submenu(Platform.i18n.get("toolbar_menu_macros"), {
                keys: ["M"],
                onshow: function (menu) {
                    if (state.macros.length) {
                        menu.enable();
                    } else {
                        menu.disable();
                    }
                },
                onopen: function (menu) {
                    menu.clear();

                    menu.addItem(Platform.i18n.get("toolbar_menu_macros_apply_all"), {
                        keys: ["A"],
                        action: function () {
                            perform(state.macros);
                        }
                    });

                    menu.separator();

                    state.macros.forEach(function (item) {
                        if (!item.search) {
                            return;
                        }

                        var text = [];

                        var keys = {
                            "ignore": Platform.i18n.get("toolbar_menu_macros_ignore"),
                            "require": Platform.i18n.get("toolbar_menu_macros_require"),
                            "move": Platform.i18n.get("toolbar_menu_macros_move"),
                            "close": Platform.i18n.get("toolbar_menu_macros_close"),
                        };

                        text.push(keys[item.action]);

                        if (item.search) {
                            text.push("<strong>" + item.search + "</strong>");
                        } else {
                            text.push(Platform.i18n.get("toolbar_menu_macros_all_tabs"));
                        }

                        if (item.action === "move") {
                            text.push(Platform.i18n.get("toolbar_menu_macros_to"));
                        } else if (item.action === "require") {
                            text.push(Platform.i18n.get("toolbar_menu_macros_in"));
                        }

                        if (item.action !== "close" && item.action !== "ignore") {
                            if (item.window) {
                                text.push('"' + item.window + '"');
                            } else {
                                text.push(Platform.i18n.get("toolbar_menu_macros_new_window"));
                            }
                        }

                        menu.addItem(text.join(" "), {
                            action: function () {
                                perform([item]);
                            }
                        });
                    });
                }
            });


            menu.separator();


            menu.submenu(Platform.i18n.get("toolbar_menu_sort_tabs"), {
                keys: ["T"],
                onopen: function (menu) {
                    menu.clear();

                    var keys = {
                        "index <": Platform.i18n.get("toolbar_menu_sort_default"),

                        "title <": Platform.i18n.get("toolbar_menu_sort_tabs_title_lt"),
                        "title >": Platform.i18n.get("toolbar_menu_sort_tabs_title_gt"),

                        "url <": Platform.i18n.get("toolbar_menu_sort_tabs_url_lt"),
                        "url >": Platform.i18n.get("toolbar_menu_sort_tabs_url_gt"),
                    };

                    var type = Options.get("tabs.sort.type");
                    keys[type] = "<strong>" + keys[type] + "</strong>";

                    function item(name, key) {
                        if (key) {
                            key = [ key ];
                        }
                        menu.addItem(keys[name], {
                            keys: key,
                            action: function () {
                                state.sortTabs(name);
                            }
                        });
                    }

                    item("index <", "D");

                    menu.separator();

                    item("url <");
                    item("url >");

                    menu.separator();

                    item("title <");
                    item("title >");
                }
            });

            menu.space();

            menu.submenu(Platform.i18n.get("toolbar_menu_sort_windows"), {
                keys: ["W"],
                onopen: function (menu) {
                    menu.clear();

                    var keys = {
                        "date-created <": Platform.i18n.get("toolbar_menu_sort_default"),

                        "name <": Platform.i18n.get("toolbar_menu_sort_windows_name_lt"),
                        "name >": Platform.i18n.get("toolbar_menu_sort_windows_name_gt"),

                        "tab-number <": Platform.i18n.get("toolbar_menu_sort_windows_tab_number_lt"),
                        "tab-number >": Platform.i18n.get("toolbar_menu_sort_windows_tab_number_gt"),
                    };

                    var type = Options.get("windows.sort.type");
                    keys[type] = "<strong>" + keys[type] + "</strong>";

                    function item(name, key) {
                        if (key) {
                            key = [ key ];
                        }
                        menu.addItem(keys[name], {
                            keys: key,
                            action: function () {
                                state.sortWindows(name);
                            }
                        });
                    }

                    item("date-created <", "D");

                    menu.separator();

                    item("name <");
                    item("name >");

                    menu.separator();

                    item("tab-number <");
                    item("tab-number >");
                }
            });
        }));
    }));


    toolbar.appendChild(UI.link(function (element) {
        element.href = "/options.html";
        element.target = "_blank";
        element.textContent = Platform.i18n.get("toolbar_options");
        element.tabIndex = 1;
    }));

    toolbar.appendChild(UI.create("span", function (element) {
        element.className = "separator";
        element.textContent = "|";
    }));

    toolbar.appendChild(UI.link(function (element) {
        element.href = "http://documentation.tab-organizer.googlecode.com/hg/Tab%20Organizer%20FAQ.html";
        element.target = "_blank";

        element.textContent = Platform.i18n.get("toolbar_faq");
        element.tabIndex = 1;
    }));


    toolbar.appendChild(UI.create("div", function (element) {
        element.id = "Undo-bar";

        element.appendChild(UI.create("div", function (container) {
            container.id = "Undo-bar-div";

            state.undoBar = container;

            container.hide = function (transition) {
                if (transition !== true) {
                    container.style.webkitTransitionDuration = "0s";

                    setTimeout(function () {
                        container.style.webkitTransitionDuration = "";
                    }, 0);
                }

                container.style.opacity = "0 !important";
                container.style.visibility = "hidden !important";
            };
            container.hide();

            var timer = {
                reset: function () {
                    clearTimeout(timer.id);
                },
                set: function () {
                    var ms = Options.get("undo.timer") * 1000;

                    timer.id = setTimeout(function () {
                        container.hide(true);
                    }, ms);
                }
            };

            addEventListener("blur", function (event) {
                if (event.target === this) {
                    timer.reset();
                }
            }, true);

            addEventListener("focus", function (event) {
                if (event.target === this) {
                    if (!state.undoBar.style.opacity) {
                        if (!timer.mouseover) {
                            timer.set();
                        }
                    }
                }
            }, true);

            addEventListener("mouseover", function (event) {
                var element = event.target;

                if (toolbar.contains(element)) {
                    if (!timer.mouseover) {
                        timer.mouseover = true;
                        timer.reset();
                    }
                } else if (timer.mouseover) {
                    timer.mouseover = false;
                    timer.set();
                }
            }, true);


            container.appendChild(UI.create("span", function (element) {
                Object.defineProperty(state.undoBar, "text", {
                    get: function () {
                        return element.innerHTML;
                    },
                    set: function (value) {
                        element.innerHTML = value;
                    }
                });
            }));

            container.appendChild(UI.link(function (element) {
                element.id = "Undo-bar-button";
                element.title = "(Ctrl Z)";
                element.textContent = Platform.i18n.get("toolbar_undo_link");
                element.tabIndex = 1;

                var should = true;

                container.show = function (name, info) {
                    timer.reset();

                    info = Object(info);

                    if (info.undo === false) {
                        element.setAttribute("hidden", "");
                        should = false;
                    } else {
                        element.removeAttribute("hidden");
                        should = true;
                    }

                    if (container.style.opacity) {
                        state.undoBar.text = name;

                        container.style.opacity = "";
                        container.style.visibility = "";
                    } else {
                        container.hide();

                        setTimeout(function () {
                            state.undoBar.text = name;

                            container.style.opacity = "";
                            container.style.visibility = "";
                        }, 100);
                    }

                    if (!timer.mouseover) {
                        timer.set();
                    }
                };


                var lastfocused;

                addEventListener("blur", function (event) {
                    lastfocused = event.target;
//                    console.log(lastfocused);
                }, true);
/*
                element.addEventListener("focus", function () {
                    console.log(lastfocused);
                    if (lastfocused) {
                        lastfocused.focus();
                    }
                }, true);*/
/*
                function focus(event) {
                    console.log(event.target);
                    event.target.focus();
//                    event.target.triggerEvent("focus", false, false);
                }*/

                element.addEventListener("mousedown", function () {
                    addEventListener("blur", events.stop, true);
                }, true);
                element.addEventListener("mouseup", function () {
                    removeEventListener("blur", events.stop, true);

                    if (lastfocused) {
                        lastfocused.focus();
                    }
                }, true);


                function undo() {
//                    console.log(lastfocused);
                    if (should && !state.undoBar.style.opacity) {
                        state.undoBar.hide();
                        Undo.pop();
                    }
                }
                element.addEventListener("click", undo, true);

                addEventListener("keyup", function (event) {
                    if (event.which === 90) {
                        if (event.ctrlKey || event.metaKey) {
                            if (!event.shiftKey && !event.altKey) {
                                undo();
                            }
                        }
                    }
                }, true);
            }));
        }));
    }));


    toolbar.appendChild(UI.create("div", function (span) {
        span.id = "search-box";

        var input = document.createElement("input");
        input.setAttribute("spellcheck", "false");
        input.setAttribute("results", "");
        input.setAttribute("incremental", "");
        input.setAttribute("placeholder", Platform.i18n.get("toolbar_search_placeholder"));

        input.id = "search-input";
        input.title = "(Ctrl F)";
        input.type = "search";
        input.tabIndex = 1;
/*!
//
//        var autocomplete = "";
//        var autocomplete = document.createElement("input");
//        autocomplete.setAttribute("spellcheck", "false");
//        autocomplete.setAttribute("results", "");
//
//        autocomplete.id = "search-autocomplete-input";
//        autocomplete.type = "search";
        autocomplete.hidden = true;
        autocomplete.disabled = true;
//
//
//        var mask = document.createElement("div");
//        mask.id = "search-autocomplete-mask";*/


        var lastinput = localStorage["search.lastinput"];
        if (typeof lastinput === "string") {
            input.value = lastinput;
        }

        var cache = {
            title: document.title
        };

        var precoded = {
            "has:macro": true,

            "intitle:": true,
            "inurl:": true,

            "is:bookmarked": true,
            "is:broken": true,
            "is:child": true,
            "is:favorited": true,
            "is:image": true,
            "is:pinned": true,
            "is:selected": true,

            "last:moved": true,
            "same:domain": true,
            "same:file": true,
            "same:path": true,
            "same:title": true,
            "same:url": true,

            "will:move": true,
            "window:": true,
            "window:focused": true
        };


        var saved = Options.get("search.past-queries");
//!            var special = Object.keys(precoded);

        if (localStorage["search.past-queries"]) { //!
            var old = Options.getObject(localStorage["search.past-queries"]);

            Object.keys(old).forEach(function (name) {
                if (old[name]) {
                    old[name].forEach(function (item) {
                        saved.push(item);
                    });
                }
            });

            delete localStorage["search.past-queries"];
        }


        function testSpecial(value) {
            input.removeAttribute("data-special");

            if (precoded[value]) {
                input.setAttribute("data-special", "");
            }
        }

        function search(windows, info) {
            localStorage["search.lastinput"] = input.value;

            testSpecial(input.value);

            if (!cache.filter || cache.input !== input.value) {
                cache.filter = action.parse(input.value);
                cache.input = input.value;
            }

            var array = state.createSearchList();

            var results = cache.filter(array);
            var focused, scroll = [];

            results.forEach(function (child) {
                var item = child.parentNode.container;
//!                    item.setAttribute("data-shouldshow", "");

                if (child.hasAttribute("data-focused")) {
                    item.selected = child;
                }

                child.removeAttribute("hidden");
            });

            results.inverse.forEach(function (child) {
                child.setAttribute("hidden", "");
            });


            var last = Options.get("window.lastfocused");

            var list = windows.filter(function (item) {
                item.removeAttribute("data-last");

                var children = Array.slice(item.tabList.children);

                var test = children.some(function (child) {
                    return !child.hasAttribute("hidden");
                });

                if (test) {
//!                    if (item.hasAttribute("data-shouldshow")) {
//!                        item.removeAttribute("data-shouldshow");
                    item.removeAttribute("hidden");

                    if (info.focused) {
                        var win = item.window;

                        if (win.focused || (!focused && last === win.id)) {
                            focused = item;
                        }
                    }

                    if (info.scroll) {
                        scroll.push(item);
                    }
                } else { //* Fixes windows showing up even when empty.
//!                        var children = Array.slice(item.tabList.children);

//!                        var test = children.every(function (child) {
//!                            return child.hasAttribute("hidden");
//!                        });

//!                        if (test) {
                    item.setAttribute("hidden", "");
//!                        }
                }

                return test;
//!                    return !item.hasAttribute("hidden");
            });

            if (list.length) {
                list[list.length - 1].setAttribute("data-last", "");
            }

            scroll.forEach(function (item) {
                if (item.selected) {
                    UI.scrollTo(item.selected, item.tabList);
                }
            });

            if (focused) {
                focused.setWindowFocus();
            }


            var length, string = [ cache.title, " (" ];

            length = results.length;
            string.push(length, Platform.i18n.get("global_tab"));

            if (length !== 1) {
                string.push(Platform.i18n.get("global_plural"));
            }


            string.push(Platform.i18n.get("title_in"));


            length = list.length;
            string.push(length, Platform.i18n.get("global_window"));

            if (length !== 1) {
                string.push(Platform.i18n.get("global_plural"));
            }


            string.push(")");

            document.title = string.join("");


            if (Options.get("windows.type") === "horizontal") {
                document.body.scrollTop = 0; //* Issue 87
            }
        }

        var timer, delay = 0;

        state.search = function anon(info) {
            info = Object(info);

            function wrapper() {
                console.log("Searching.");

                search(state.sorted, info);
            }

            clearTimeout(anon.timer);

            if (info.nodelay) {
                wrapper();
            } else {
                anon.timer = setTimeout(wrapper, delay);
            }
        };

        state.search.delay = function (n) {
            delay = n;

            clearTimeout(timer);

            timer = setTimeout(function () {
                delay = 0;
            }, n);
        };

        Platform.event.on("tab-indent", state.search);

        input.addEventListener("search", function () {
            state.search({ focused: true, scroll: true });
        }, true);

        addEventListener("keydown", function (event) {
            if (event.which === 70 && (event.ctrlKey || event.metaKey)) {
                if (!event.altKey && !event.shiftKey) {
                    event.preventDefault();
                    input.focus();
                    input.select();
                }
            }
        }, false);

//!        span.appendChild(autocomplete);
//!        span.appendChild(mask);
        span.appendChild(input);

        setTimeout(function () {
            input.focus();
            input.select();
        }, 0);


        span.appendChild(UI.create("div", function (container) {
            container.id = "search-past";
            container.tabIndex = -1;


            container.addEventListener("focus", function (event) {
                this.removeAttribute("hidden");
                input.focus();
            }, true);

            input.addEventListener("blur", function () {
                container.setAttribute("hidden", "");
            }, true);


            input.addEventListener("search", function () {
                if (!this.value || this.value.length < 2) {
                    return;
                }

                var value = this.value;

                var remove = [];

                saved.forEach(function (item, i) {
                    if (value.indexOf(item) === 0) {
                        remove.push(i);
                    }
                });

                remove.forEach(function (key) {
                    saved.splice(key, 1);
                });

                var test = saved.some(function (item) {
                    return item.indexOf(value) === 0;
                });

                if (!test) {
                    var length = saved.unshift(value);
                    if (length > 50) {
                        saved.length = 50;
                    }
                }
            }, true);

//!
//!            var backspace;

            input.addEventListener("input", function () {
/*!                setTimeout(function () {
                    if (backspace) {
                        return;
                    }

                    var value = input.value;
                    if (value) {
                        var next = saved.find(function (item) {
                            return item.indexOf(value) === 0;
                        });

                        if (next) {
                            input.value = next;

                            var alpha = value.length,
                                omega = input.value.length;

                            if (alpha !== omega) {
            //                    input.value = autocomplete;
                                input.setSelectionRange(alpha, omega);
                            }
                        }
                    }


                }, 0);*/
                filter(this.value);
/*!
                var value = this.value;
                if (value) {
                    var next = saved.find(function (item) {
                        return item.indexOf(value) === 0;
                    });

                    autocomplete = (next
                                     ? next
                                     : value);
//
//                    console.log(, input.value.length);

                    testSpecial(value);
                } else {
                    autocomplete = "";
                }*/
            }, true);
/*!
            input.addEventListener("blur", function () {
                autocomplete = this.value;
//!                this.value = autocomplete.value;
//!                state.search({ focused: true, scroll: true });
            }, true);*/
/*!
            input.addEventListener("keydown", function (event) {
                backspace = (event.which === 8); //* Backspace
                setTimeout(function () {
                    autocomplete.scrollLeft = input.scrollLeft;
                }, 0);
//
//                input.setSelectionRange(5, 10);
//
//                console.log(input.scrollLeft, autocomplete.scrollLeft);
//
//                console.log(input.scrollWidth - autocomplete.scrollWidth);
//                autocomplete.setSelectionRange(input.selectionStart, input.selectionEnd);
//
                if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
                    return;
                }
//                autocomplete.selectionStart = input.selectionStart;
//                console.log(input.selectionStart, autocomplete.selectionStart);
//                console.log();
//
//                console.log(input.scrollLeft);

                if (event.which === 9) { //* Tab
                    if (this.value !== autocomplete) {
                        this.value = autocomplete;
                        event.preventDefault();

                        state.search({ focused: true, scroll: true });
                        filter(this.value);
                    }
                } else if (event.which === 13) { //* Enter
                    var query = container.querySelector("[data-selected]");
                    if (!query) {
                        autocomplete = this.value;
                        filter("");
                    }
                }
            }, true);*/
/*!

            input.addEventListener("keyup", function (event) {
//                autocomplete.scrollLeft = input.scrollLeft;
//
                setTimeout(function () {
                    if (backspace) {
//                        console.log(event);
                        return;
                    }

                    var alpha = input.value.length,
                        omega = autocomplete.length;
//
//                    console.log(backspace);

                    if (alpha !== omega) {
                        input.value = autocomplete;
                        input.setSelectionRange(alpha, omega);

                        input.setAttribute("hidden", "");
                        input.removeAttribute("hidden");
                    }
                }, 0);
            }, true);*/


            function filter(value, all) {
                container.reset();

                var first, dupes = {};

                if (value || all) {
                    saved.forEach(function (key) {
                        if (key !== value && key.indexOf(value) === 0) {
                            if (!dupes[key]) {
                                dupes[key] = true;

                                var item = container.add(key, precoded[key]);

                                if (!first) {
                                    first = true;
                                    item.setAttribute("data-selected");
                                }
                            }
                        }
                    });
                }
            }

            function remove(text) {
                saved.remove(text);

                filter(input.value);
            }


            function mouseover(event) {
                var query = container.querySelector("[data-selected]");
                if (query) {
                    query.removeAttribute("data-selected");
                }
                this.setAttribute("data-selected", "");
            }

            function mouseout(event) {
                this.removeAttribute("data-selected");
            }

            function click(event) {
                if (event.target.className === "past-queries-close") {
                    remove(this.text);
                } else {
                    input.value = /*!autocomplete = */this.text;
                    state.search({ focused: true, scroll: true });

                    container.reset();
                }
            }


            container.add = function (name, special) {
                var item = document.createElement("div");
                item.className = "search-past-item";
                item.text = name;

                if (special) {
                    item.setAttribute("data-special", "");
                }

                item.addEventListener("click", click, true);
                item.addEventListener("mouseover", mouseover, true);
                item.addEventListener("mouseout", mouseout, true);


                var text = document.createElement("div");
                text.className = "search-past-item-text";
                text.textContent = text.title = name;
                item.appendChild(text);


//!                if (!special) {
                var button = document.createElement("img");
                button.className = "past-queries-close";
                button.src = "/images/button-close.png";
                item.appendChild(button);
//!                }

                container.appendChild(item); //! element
                container.removeAttribute("hidden");

                container.style.maxHeight = item.offsetHeight * Options.get("search.show-number") + "px";
//
//                console.log(item.offsetHeight, item.getBoundingClientRect());

                return item;
            };

            container.reset = function () {
                container.setAttribute("hidden", "");
                container.innerHTML = ""; //! element
            };
            container.reset();


            input.addEventListener("mousedown", function (event) {
                if (event.button !== 0) {
                    return;
                }
                if (event.offsetX < 20) {
                    filter(this.value, true);
                }
            }, true);

            input.addEventListener("keydown", function anon(event) {
                var next, query;

                if (event.which === 38 || event.which === 40) { //* Up/Down
                    event.preventDefault();

                    query = container.querySelector("[data-selected]");

                    if (query) {
                        next = (event.which === 38
                                 ? query.previousSibling
                                 : query.nextSibling);

                    } else if (event.which === 40) {
                        next = container.firstChild;
                    }

                    if (next) {
                        next.setAttribute("data-selected", "");
                        next.scrollIntoViewIfNeeded(false);

                        if (query) {
                            query.removeAttribute("data-selected");
                        }
                    }
                } else if (event.which === 27) { //* Escape
                    if (!container.hasAttribute("hidden")) {
                        event.preventDefault();
                    }

                    container.reset();
                } else if (event.which === 13) { //* Enter
                    query = container.querySelector("[data-selected]");
                    if (query) {
                        query.triggerEvent("click", false, false);
                    }
                } else if (event.which === 46) { //* Delete
                    query = container.querySelector("[data-selected]");
                    if (query) {
                        event.preventDefault();

                        var children = container.children;
                        var index = Array.indexOf(children, query);

                        remove(query.textContent);

                        if (children[index]) {
                            next = children[index];
                        } else if (children[index - 1]) {
                            next = children[index - 1];
                        }

                        if (next) {
                            next.setAttribute("data-selected", "");
                        }
                    }
                }
            }, true);

            input.addEventListener("keyup", function (event) {
                if (!container.hasAttribute("hidden")) {
                    return;
                }

                if (event.which === 40 || event.which === 46) {
                    filter(this.value, true);
                }
            }, true);
        }));
    }));
/*!
    container.appendChild(UI.create("button", function (button) {
        button.className = "Options-button";
        button.textContent = "Reopen Closed Tab";
        button.tabIndex = 1;
    }));

    container.appendChild(UI.create("button", function (button) {
        button.className = "Options-button";
        button.textContent = "Foo";
        button.tabIndex = 1;
    }));
*/
}));



(function () {
    var script = document.createElement("script");
    script.src = "/views/" + Options.get("windows.type") + ".js";


    var windows = Platform.windows.getAll();

    function init() {
        state.createView(windows);

        var type;

        type = Options.get("windows.sort.type");
        if (type !== "date-created <") {
            state.sortWindows(type);
        }

        type = Options.get("tabs.sort.type");
        if (type !== "index <") {
            state.sortTabs(type);
        }
/*
        Platform.event.on("tab-focus", function () {
            if (Options.get("popup.close.when") === "switch-tab") {
                close();
            }
        });

        Platform.event.on("window-focus", function () {
            if (Options.get("popup.close.when") === "switch-window") {
                close();
            }
        });*/

        Options.event.on("change", function (event) {
            if (event.name === "macros.list") {
                state.search();
            }
        });

        Options.event.on("change", function (event) {
            if (event.name === "tabs.sort.type") {
                state.search({ scroll: true, nodelay: true });

            } else if (event.name === "windows.sort.type") {
                state.search({ focused: true, scroll: true, nodelay: true });
            }
        });

        Options.event.on("change", function (event) {
            if (event.name === "window.lastfocused") {
                if (event.value === null) {
                    action.unselectWindow();
                } else {
                    var item = state.windows[event.value];
                    if (item) {
                        item.select();

                        state.search({
                            focused: Options.get("popup.type") !== "tab",
                            nodelay: true
                        });
                    }
                }
            }
        });

        Options.event.on("change", function (event) {
            var treestyle = (event.name === "tabs.tree-style.enabled"),
                location  = (event.name === "tabs.close.location"),
                display   = (event.name === "tabs.close.display");

            if (treestyle || location || display) {
                var query = document.querySelectorAll(".tab");
                for (var i = 0; i < query.length; i += 1) {
                    query[i].updateButtonPositions();
                }
            }
        });


        /*

        (options-change (e) (windows.button.dropdown
                             windows.button.close)
          (let name (if (it 0) 'dropdown 'closeButton)
          (let name (case it
                      'windows.button.dropdown 'dropdown
                      'windows.button.close    'closeButton)
            (each x state!list
              (if e!value
                    (x!appendChild (ref x name))
                  (x!removeChild (ref x name))))))
        */


        /*

        (mac on-option-change (parms test . body)
          `(on option-change ,parms
             (when (in (ref ,(car parms) 'name) ,@test)
               (let it (map [is _ (ref ,(car parms) 'name)] ',test)
                 ,@body))))


        (on-option-change (e) (windows.button.dropdown
                               windows.button.close)
          (let query (if (it 0)
                           (css ".tab-icon-dropdown")
                         (css ".window-button-close"))
            (each x query
              (if e!value
                    (show x)
                  (hide x)))))

        */


        Options.event.on("change", function (event) {
            var dropdown = (event.name === "windows.button.dropdown"),
                close    = (event.name === "windows.button.close");

            //var name = (dropdown ? "dropdown" : close && "closeButton");

            if (dropdown || close) {
                /*for (var i = 0; i < state.list.length; i += 1) {
                    if (event.value) {
                        state.list[i].appendChild(state.list[i][name]);
                    } else {
                        state.list[i].removeChild(state.list[i][name]);
                    }
                }*/
                var query = (dropdown
                              ? document.querySelectorAll(".tab-icon-dropdown")
                              : close &&
                                document.querySelectorAll(".window-button-close"));

                for (var i = 0; i < query.length; i += 1) {
                    if (event.value) {
                        query[i].removeAttribute("hidden");
                    } else {
                        query[i].setAttribute("hidden", "");
                    }
                    //query[i].style.display = (event.value ? "" : "none");
                }
            }
        });

        Options.event.on("change", function /*! anon*/(event) {
            if (event.name === "tabs.favorites.urls") {
                //! clearTimeout(anon.timer);

                if (event.action === "delete") {
                    state.tabsByURL[event.value].forEach(function (item) {
                        item.removeAttribute("data-favorited");
                    });
                } else {
                    state.tabsByURL[event.value].forEach(function (item) {
                        item.setAttribute("data-favorited", "");
                    });
                }

                //! anon.timer = setTimeout(function () {
                state.search();
                //! }, 0);

                document.body.setAttribute("hidden", "");
                document.body.removeAttribute("hidden");
            }
        });


        state.search({ scroll: true, focused: true, nodelay: true });

        state.loaded = true;
    }

    if (windows.length) {
        script.addEventListener("load", init, true); //* Issue 69
    } else {
        Platform.event.on("load", init);
    }

    fragment.appendChild(script);
}());

document.body.appendChild(fragment);
