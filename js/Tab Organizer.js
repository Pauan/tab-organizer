/*global action, events, Options, Platform, state, UI, Undo, window */
"use strict";

//var Tab, Window;

var Tab = {
    focus: function (tab, focus) {
        var focused = Options.get("window.lastfocused"),
            when    = Options.get("popup.close.when"),
            action  = Options.get("popup.switch.action");

        var should = (focus   !== false &&
                      focused !== tab.windowId);

        Platform.tabs.focus(tab, should || (action  === "minimize"    &&
                                            when    === "switch-tab") ||
                                           (action  === "show"        &&
                                            when    === "switch-window"));
                                 //should || action === "minimize"
                                 //should || when === "switch-window"

        /*

        minimize:
          tab     focus window
          window  focus window if should

        close:
          tab     focus window if should + close popup
          window  focus window if should + close popup if should

        show:
          tab     focus window if should + focus popup if should
          window  focus window           + focus popup if should

        */

        if (action === "close" && (!tab.selected || should)) {
            if (when === "switch-tab" || (should && when === "switch-window")) {
                return close(); //! returns to prevent the popup from "flickering"
            }
        } else if (should && action === "show" && Options.get("popup.type") !== "tab") {
            Platform.tabs.getCurrent(function (tab) {
                Platform.tabs.focus(tab, true);
            });
        }
    },


    move: function (item, info, action) {
        Platform.tabs.move(item.tab, info, action);
    },


    proxy: function (tab) {
        return UI.create("div", function (container) {
            container.className = "tab";
            container.draggable = true;
//            container.tab = tab;
            container.undoState = {};

            state.tabsByID[tab.id] = container;


            var cell = {
                favicon: UI.create("img", function (element) {
                    element.className = "tab-favicon";
                    element.setAttribute("alt", "");
                }),

                favorite: UI.create("div", function (element) {
                    element.className = "tab-favorite";
                    element.title = Platform.i18n.get("tab_favorite");

                    element.addEventListener("click", events.stop, true);

                    element.addEventListener("click", function () {
                        var tab = container.tab;

                        if (container.hasAttribute("data-favorited")) {
                            state.favorites.set(tab.url, null);
                        } else {
                            state.favorites.set(tab.url, state.tabsByURL[tab.url].length);
                        }
                    }, true);
                }),

                text: UI.create("div", function (element) {
                    element.className = "tab-text";

                    container.tabText = element;

                    /*! container.addEventListener("dblclick", function (event) {
                        if (false) {
                        //! if (event.button === 0 && container.hasAttribute("data-focused")) {
                            container.draggable = false;

                            element.replaceChild(UI.create("input", function (input) {
                                input.className = "url-input";
                                input.type = "text";

                                input.value = tab.url;
                                input.tabIndex = -1;

                                input.addEventListener("keyup", function (event) {
                                    if (event.which === 13 || event.which === 27) {
                                        if (event.which === 13) {
                                            Tab.gotoURL(tab, this.value);
                                        }
                                        container.parentNode.focus();
                                    }
                                }, true);
                                input.addEventListener("blur", function (event) {
                                    element.replaceChild(span, input);

                                    container.draggable = true;
                                }, true);

                                setTimeout(function () {
                                    input.select();
                                }, 0);
                            }), span);
                        }
                    }, true);*/
                }),

                close: UI.create("div", function (element) {
                    element.className = "tab-button-close";
                    element.title = Platform.i18n.get("tab_close") + "(Alt Click)";
                    element.draggable = true;

                    element.addEventListener("dragstart", events.disable, true);

                    element.addEventListener("click", function (event) {
                        event.stopPropagation();
                        Platform.tabs.remove(container.tab);
                    }, true);
                })
            };


            var url;

            container.update = function (tab) {
                container.tab = tab;

                state.tabsByURL.add(tab.url, container);

                if (state.favorites.get(tab.url)) {
                    container.setAttribute("data-favorited", "");
                }
                if (tab.pinned) {
                    container.setAttribute("data-pinned", "");
                }
                if (tab.selected) {
                    container.setAttribute("data-focused", "");
                }
//
//                console.log(tab);

                var text     = tab.title || tab.url,
                    location = tab.location;

                if (tab.pinned) {
                    cell.favicon.src = "/images/pinned.png";
                } else {
//                    cell.favicon.src = "";
/*
                    var exclude = function (x) {
                        for (var i = 1 ; i < arguments.length; i += 1) {
                            if (arguments[i] === x) {
                                return false;
                            }
                        }
                        return true;
                    };*/
//
//                    if (tab.window.title === "~Crashes") {
//                        console.log(tab.title);
//                        console.log(tab.url);
//                    }
//
//                    if (exclude(tab.window.title, "~Stuff", "~Crashes")/* && (tab.index < 163 || tab.index > 162)*/) {
//                    if (false && tab.window.title !== "~Crashes") {
//                        console.log(tab);
//                        return;
                    cell.favicon.src = "chrome://favicon/" + tab.url;
//                    }
                }

                cell.favicon.title = text;
                cell.text.title = text;
                cell.text.textContent = text;

                url = UI.create("span", function (element) {
    //                var url = tab.url;
    //                try {
    //                    url = decodeURI(url);
    //                } catch (e) {}
    //
    //                var match = /^([^:]+)(:\/\/)([^\/]*)([^?#]*\/)([^#]*)(#.*)?$/.exec(url);
                    var secure = {
                        "https": true
                    };
    //
    //                var url = {};

    //                if (match) {
                    if (location.protocol !== "http") {
                        element.appendChild(UI.create("span", function (element) {
                            element.className = "protocol";
                            if (secure[location.protocol]) {
                                element.setAttribute("data-secure", "");
                            }
                            element.textContent = location.protocol;
                        }));
                        element.appendChild(document.createTextNode(location.separator));
                    }
                    element.appendChild(UI.create("span", function (element) {
                        element.className = "domain";
                        element.textContent = location.domain;
                    }));

                    element.appendChild(document.createTextNode(location.path));

                    if (location.query || location.file) {
                        //console.log(location.query, location.file);
                        element.appendChild(UI.create("span", function (element) {
                            element.className = "query";
                            element.textContent = location.file + location.query;
                        }));
                    }
                    if (location.hash) {
                        element.appendChild(UI.create("span", function (element) {
                            element.className = "fragment";
                            element.textContent = location.hash;
                        }));
                    }
    //                }
                });
//
//                document.body.setAttribute("hidden", "");
//                document.body.removeAttribute("hidden");
            };
            container.update(tab);


            container.indent = function (indent) {
                if (indent && Options.get("tabs.tree-style.enabled")) {
                    container.style.marginLeft = indent * 5 + "px";
                } else {
                    container.style.marginLeft = "";
                }
            };


            container.queueAdd = function () {
                var is = container.parentNode.queue.add(container);
                container.undoState.selected = !is;

                container.setAttribute("data-selected", "");

                state.search();
            };

            container.queueRemove = function () {
                var is = container.parentNode.queue.remove(container);
                container.undoState.selected = is;

                container.removeAttribute("data-selected");

                state.search();
            };

            container.queueToggle = function () {
                var toggle = container.parentNode.queue.toggle(container);
                container.undoState.selected = toggle;

                if (toggle) {
                    container.setAttribute("data-selected", "");
                } else {
                    container.removeAttribute("data-selected");
                }

                state.search();
            };

//!            container.addEventListener("DOMNodeRemovedFromDocument", container.queueRemove, true); //! Hacky


            container.addEventListener("mouseout", function (event) {
                state.urlBar.setAttribute("hidden", "");
            }, true);

            container.addEventListener("mouseover", function (event) {
                var bar = state.urlBar;

                if (bar.firstChild) {
                    bar.removeChild(bar.firstChild);
                }
                bar.appendChild(url);

                bar.removeAttribute("hidden");
            }, true);


            container.addEventListener("click", function (event) {
                var range, parent = this.parentNode;

                if (event.button === 0) {
                    if (event.ctrlKey || event.metaKey) {
                        this.queueToggle();

                        if (this.hasAttribute("data-selected")) {
                            parent.queue.shiftNode = this;
                        } else {
                            delete parent.queue.shiftNode;
                        }

                    } else if (event.shiftKey) {
                        parent.queue.reset();

                        if (parent.queue.shiftNode) {

                            range = Array.slice(parent.children);
                            range = range.range(this, parent.queue.shiftNode);

                            if (range.length) {
                                range.forEach(function (item) {
                                    if (!item.hasAttribute("hidden")) {
                                        item.queueAdd();
                                    }
                                });

                                if (Options.get("undo.select-tabs")) {
                                    Undo.push("select-tabs", {
                                        queue: parent.queue,
                                        type: "select",
                                        list: range
                                    });

                                    var text = [];

                                    text.push(Platform.i18n.get("undo_message_selected"));

                                    text.push(range.length);
//
//                                    var text =  +
//                                                range.length +
//                                                (range.length === 1
//                                                    ? " tab."
//                                                    : " tabs.");

                                    text.push(Platform.i18n.get("global_tab"));

                                    if (range.length !== 1) {
                                        text.push(Platform.i18n.get("global_plural"));
                                    }

                                    text.push(Platform.i18n.get("global_end"));

                                    state.undoBar.show(text.join(""));
                                }
                            } else {
                                delete parent.queue.shiftNode;
                            }
                        } else {
                            parent.queue.shiftNode = this;
                            this.queueAdd();
                        }

                    } else if (event.altKey) {
                        Platform.tabs.remove(container.tab);

                    } else {
                        switch (Options.get("tabs.click.type")) {
                        case "select-focus":
                            if (this.hasAttribute("data-selected")) {
                                Tab.focus(container.tab);
                            } else {
                                parent.queue.reset();
                                parent.queue.shiftNode = this;
                                this.queueAdd();
                            }
                            break;
                        case "focus":
                            if (!this.hasAttribute("data-selected")) {
                                parent.queue.reset();
                                delete parent.queue.shiftNode;
                            }
                            Tab.focus(container.tab); //! `tab` object is replaced after moving
                        }
                    }
                }
            }, false);

            container.addEventListener("mouseup", function (event) {
                if (event.button === 1) {
                    Platform.tabs.remove(container.tab);
                }
            }, false);


///*                var prev, next;
//*/

///*                var prev, next;

            container.addEventListener("dragover", function (event) {
                state.placeholder.remove();
                var parent = this.parentNode;
                var check = state.placeholder.check;

                var alpha = (this.offsetHeight / 5),
                    omega = (this.offsetHeight - alpha);

                var prev = this.previousSibling,
                    next = this.nextSibling;

                var test = (prev || state.draggedTab !== this);

                if (event.offsetY < alpha && test && check(null, prev)) {
                    parent.insertBefore(state.placeholder, this);
                } else if (event.offsetY > omega && check(this, next)) {
                    parent.insertBefore(state.placeholder, next);
                } else if (check(this)) {
                    this.setAttribute("data-dropindent", "");
                }
            }, true);
/*!

            function findtop(node, top) {
//                console.log(node);
//                try {
                if (node === top) {
                    return null;
                } else if (node.className === "tab") {
                    return node;
                } else {
                    return findtop(node.parentNode, top);
                }
//                } catch (e) {
//
//                }
            }

            container.addEventListener("drag", function (event) {
//                if (oldnode) {
//
//                }
                removeHighlight();
                delete this.tab.dropIndent;

                var target = document.elementFromPoint(event.clientX, event.clientY);

                var node = findtop(target, this.parentNode);
//                console.log(node);
                if (node) {
                    node.setAttribute("data-dropindent", "");
                    this.tab.dropIndent = true;
                    oldnode = node;
                }// else {
//                    console.log(event.type);
//                }
            }, true);*/


            container.addEventListener("dragstart", function (event) {
                //! container.removeEventListener("dragover", events.disable, true);

                state.urlBar.setAttribute("hidden", "");

                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/uri-list", container.tab.url);
                event.dataTransfer.setData("text/plain", container.tab.url);

                state.highlighted = this;
                state.currentQueue = this.parentNode.queue;

                if (!state.currentQueue.length) {
                    state.currentQueue.add(state.highlighted);
                }

                state.draggedTab = this;
            }, true);

            /*! container.addEventListener("dragend", function (event) {
                container.addEventListener("dragover", events.disable, true);
            }, true);*/


            function blur() {
                cell.close.setAttribute("hidden", "");
            }
            function focus() {
                cell.close.removeAttribute("hidden");
            }

            container.updateButtonPositions = function () {
                cell.close.removeAttribute("data-display-hover");
                cell.close.removeAttribute("hidden");

                container.removeEventListener("Platform-blur", blur, true);
                container.removeEventListener("Platform-focus", focus, true);


                var tab = container.tab;

                var indent = state.indent[tab.window.index];
                if (indent && (indent = indent[tab.index])) {
                    container.indent(indent);
                }


                switch (Options.get("tabs.close.display")) {
                case "hover":
                    cell.close.setAttribute("data-display-hover", "");
                    break;
                case "focused":
                    if (!container.hasAttribute("data-focused")) {
                        cell.close.setAttribute("hidden", "");
                    }
                    container.addEventListener("Platform-blur", blur, true);
                    container.addEventListener("Platform-focus", focus, true);
                }


                switch (Options.get("tabs.close.location")) {
                case "left":
                    container.appendChild(cell.close);
                    container.appendChild(cell.text);
                    container.appendChild(cell.favicon);
                    container.appendChild(cell.favorite);
                    break;
                case "right":
                    container.appendChild(cell.favicon);
                    container.appendChild(cell.favorite);
                    container.appendChild(cell.text);
                    container.appendChild(cell.close);
                }
            };
            container.updateButtonPositions();
        });
    }
};



var Window = {
    create: function (array, info) {
        info = Object(info);

        Platform.windows.create({ url: "lib/remove.html" }, function (win) {
            if (info.title) {
                win.title = info.title;
            }

            if (array) {
                array.moveTabs(win, { undo: info.undo });
            }

            if (typeof info.action === "function") {
                info.action(win);
            }
        });
    },


    proxy: function (win) {
        var fragment = document.createDocumentFragment();

        fragment.appendChild(UI.create("div", function (container) {
            container.className = "window";

            state.windows[win.id] = container;
            state.list.add(container);

            container.window = win;
            container.tabIndex = -1; //! 2


            function scrollTo() {
                UI.scrollIntoView(container.tabContainer, document.body);
                //! UI.scrollIntoView(container.tabList, document.body, 41);
            }

            container.select = function () {
                action.unselectWindow();

                container.setAttribute("data-focused", "");
            };

            container.unselect = function () {
                var id = Options.get("window.lastfocused");
                if (id === null) {
                    action.unselectWindow();
                } else if (state.windows[id]) {
                    state.windows[id].select();
                }
            };

            container.setWindowFocus = function () {
                container.select();
                scrollTo();
            };


            container.addEventListener("blur", function (event) {
                this.removeAttribute("data-selected");

                container.unselect();

                state.placeholder.remove();
            }, true);

            container.addEventListener("focus", function (event) {
                /*! if (!state.dragging) {
                    scrollTo.call(this);
                }
*/
                this.setAttribute("data-selected", "");

                container.select();
            }, true);


            function iter(element, which) {
                element = (which
                            ? element.previousSibling
                            : element.nextSibling);

                if (element) {
                    if (!element.hasAttribute("hidden")) {
                        return element;
                    } else {
                        return iter(element, which);
                    }
                }
            }

            container.addEventListener("keydown", function (event) {
                var query;

                if (event.target.localName === "input") {
                    return;
                }

                if (event.which === 32 || event.which === 13) { //* Space/Enter
                    event.preventDefault();

                    query = this.querySelector(".tab[data-focused]");
                    if (query) {
                        var info = document.createEvent("MouseEvents");
                        info.initMouseEvent("click", true, false, window, 0, 0, 0, 0, 0,
                            event.ctrlKey, event.altKey, event.shiftKey, event.metaKey, 0, null);

                        query.dispatchEvent(info);
                    }
                } else if (!event.ctrlKey && !event.metaKey) {
                    if (event.which === 37 || event.which === 39) { //* Left/Right
                        query = this.querySelector(".tab[data-focused]");
                        if (query) {
                            event.preventDefault();

                            if (query.previousSibling) {
                                if (event.which === 37) {
                                    state.indent.sub(query.tab);
                                } else {
                                    state.indent.add(query.tab);
                                }
                            }
                        }
                    } else if (event.which === 38 || event.which === 40) { //* Up/Down
                        query = this.querySelector(".tab[data-focused]");
                        if (query) {
                            event.preventDefault();

                            var element = iter(query, event.which === 38);
                            if (element) {
                                state.event.trigger("tab-focus", element.tab);
                            }
                        }
                    }
                }
            }, true);


            container.addEventListener("dragstart", function (event) {
                //! container.removeEventListener("dragover", events.disable, true);

                addEventListener("blur", function anon(event) {
                    this.removeEventListener(event.type, anon, true);
                    event.stopPropagation();
                }, true);
            }, true);

            container.addEventListener("dragenter", container.focus, true);
            container.addEventListener("dragover", events.disable, true);

            container.addEventListener("dragover", function (event) {
                var list = this.tabList;

                var last = list.lastChild;
                if (last === state.placeholder) {
                    last = last.previousSibling;
                }

                var alpha = list.firstChild.getBoundingClientRect(),
                    omega = last.getBoundingClientRect();

                var check = state.placeholder.check;

                if (event.clientY > omega.bottom) {
                    if (check(last)) {
                        list.appendChild(state.placeholder);
                        state.placeholder.update();
                    }
                } else if (event.clientY < alpha.top) {
                    if (check(list.firstChild)) {
                        list.insertBefore(state.placeholder, list.firstChild);
                        state.placeholder.update();
                    }
                }
            }, true);

            container.addEventListener("drop", function (event) {
                var index = 0;

                var node = document.querySelector(".tab[data-dropindent]");
                if (node) {
                    index = node.tab.index + 1;
                } else {
                    var sib = state.placeholder.previousSibling;
                    if (sib) {
                        index = sib.tab.index + 1;
                    }
                }

                if (state.currentQueue) {
                    state.search.delay(1000);

                    state.currentQueue.moveTabs(win, { index: index, child: !!node });
                }
            }, true);


            container.appendChild(UI.create("div", function (element) {
                element.className = "tab-icon-border";


                container.updateTooltip = function () {
                    var length = win.tabs.length;
                    if (length && win.title) {
                        var text = [ win.title ];

                        text.push(" (");
                        text.push(length);

                        text.push(Platform.i18n.get("global_tab"));

                        if (length !== 1) {
                            text.push(Platform.i18n.get("global_plural"));
                        }

                        text.push(")");

                        element.title = text.join("");
                    } else {
                        element.title = "";
                    }
                };


                function invalid(element, event) {
                    var box = element.getBoundingClientRect();

                    var height = event.pageY > box.bottom;
                    var options = !Options.get("windows.middle-close");
                    var selected = !container.hasAttribute("data-selected");

                    return height || options || selected;
                }

                element.addEventListener("mousedown", function (event) {
                    if (invalid(this, event)) {
                        return;
                    }

                    if (event.button === 1) {
                        Platform.windows.remove(win);
                    }
                }, true);


                element.appendChild(UI.create("div", function (stack) {
                    stack.className = "tab-icon-container";

                    stack.appendChild(UI.create("div", function (icon) {
                        icon.className = "tab-icon";

                        container.tabIcon = icon;

                        icon.appendChild(UI.create("input", function (element) {
                            element.setAttribute("spellcheck", "false");
                            element.className = "tab-icon-text";
                            element.type = "text";
                            element.tabIndex = -1;

                            icon.indexText = element;


                            var value, index = state.list.indexOf(container);

                            element.value = action.returnTitle(index);


                            Object.defineProperty(win, "title", {
                                get: function () {
                                    return element.value;
                                },
                                set: function (value) {
                                    if (value) {
                                        state.titles[index] = value;
                                    } else {
                                        delete state.titles[index];
                                    }
                                    element.value = action.returnTitle(index);

                                    Platform.event.trigger("window-rename");
                                },
                                configurable: true
                            });

                            container.updateTooltip();


                            function select() {
                                if (this.selectionStart === this.selectionEnd) {
                                    this.select();
                                }
                            }

                            element.addEventListener("mousedown", function (event) {
                                this.removeEventListener("click", select, true);

                                if (container.hasAttribute("data-focused")) {
                                    this.addEventListener("click", select, true);
                                } else {
                                    container.focus();

                                    event.preventDefault();
                                }
                            }, true);

                            element.addEventListener("focus", function (event) {
                                value = this.value;
                            }, true);

                            element.addEventListener("blur", function (event) {
                                if (this.value !== value) {
                                    win.title = this.value;

                                    if (Options.get("undo.rename-window")) {
                                        Undo.push("rename-window", {
                                            window: win,
                                            value: value,
                                            node: this
                                        });

                                        var text =
                                                Platform.i18n.get("undo_message_rename") +
                                                Platform.i18n.get("global_window") +
                                                " \"" + this.value + "\"" +
                                                Platform.i18n.get("global_end");

                                        state.undoBar.show(text);
                                    }
                                }
                            }, true);

                            element.addEventListener("keydown", function (event) {
                                if (event.which === 27) { //* Escape
                                    event.preventDefault();
                                }
                            }, true);

                            element.addEventListener("keyup", function (event) {
                                if (event.which === 13 || event.which === 27) { //* Enter/Escape
                                    if (event.which === 27) { //* Escape
                                        this.value = value;

                                        container.tabList.focus();
                                        //! container.tabList.focus();
                                    }
                                    this.blur();
                                }
                            }, true);
                        }));
                    }));
                }));
            }));


            container.closeButton = UI.create("div", function (element) {
                element.className = "window-button-close";
                //! the title shouldn't have the <u></u> tag in it but the
                //! menu item should... maybe use a regexp? Or two separate
                //! items in the translation list? Yeah, the latter sounds
                //! good
                element.title = Platform.i18n.get("window_close");

                if (!Options.get("windows.button.close")) {
                    element.setAttribute("hidden", "");
                    //element.style.display = "none";
                }
                //element.draggable = true;

                //element.addEventListener("dragstart", events.disable, true);
                //element.addEventListener("mousedown", events.stop, true);

                container.addEventListener("mousedown", function (event) {
                    if (event.target === element) {
                        event.preventDefault();
                    }
                }, true);

                element.addEventListener("click", closeWindow, true);
            });

            container.appendChild(container.closeButton);


            function closeWindow() {
                //event.stopPropagation();
                //
                state.search.delay(1000);

                Platform.windows.remove(container.window);
            }


            container.dropdown = UI.create("div", function (element) {
                element.className = "tab-icon-dropdown";
                element.title = Platform.i18n.get("window_menu_open") + "(Ctrl M)";

                if (!Options.get("windows.button.dropdown")) {
                    element.setAttribute("hidden", "");
                    //element.style.display = "none";
                }

                var contextMenu = UI.contextMenu(function (menu) {
                    element.addEventListener("mousedown", function (event) {
                        if (event.button !== 2) {
                            menu.show();
                        }
                    }, true);

                    container.addEventListener("contextmenu", function (event) {
                        if (event.target.localName === "input") {
                            return;
                        } else if (event.defaultPrevented) {
                            return;
                        }

                        event.preventDefault();

                        menu.show({
                            x: event.clientX,
                            y: event.clientY
                        });
                    }, false);

                    container.addEventListener("keypress", function (event) {
                        if (event.which === 13 && (event.ctrlKey || event.metaKey)) {
                            if (!event.altKey && !event.shiftKey) {
                                event.preventDefault();
                                menu.show();
                            }
                        }
                    }, true);


                    /*! menu.addItem("<u>B</u>ack", function () {
                        alert("Back");
                    }).disable();
                    menu.addItem("<u>F</u>orward", function () {
                        alert("Forward");
                    }).disable();
                    menu.addItem("Re<u>l</u>oad");
                    menu.separator();
                    menu.addItem("Save <u>A</u>s...");
                    menu.addItem("P<u>r</u>int...");
                    menu.addItem("<u>T</u>ranslate to English").disable();
                    menu.addItem("<u>V</u>iew Page Source");
                    menu.addItem("View Page <u>I</u>nfo");
                    menu.separator();
                    menu.addItem("I<u>n</u>spect Element");
                    menu.separator();
                    menu.addItem("Input <u>M</u>ethods").disable();
                    return;*/

                    menu.addItem(Platform.i18n.get("window_menu_new_tab"), {
                        keys: ["T"],
                        action: function () {
                            Platform.tabs.create({
                                windowId: win.id
                            }, function (tab) {
                                if (Options.get("undo.new-tab")) {
                                    Undo.push("new-tab", {
                                        tab: tab
                                    });
                                    state.undoBar.show(Platform.i18n.get("undo_message_create_new") +
                                                       Platform.i18n.get("global_tab") +
                                                       Platform.i18n.get("global_end"));
                                }
                            });
                        }
                    });

                    menu.separator();

                    menu.addItem(Platform.i18n.get("window_menu_rename_window"), {
                        keys: ["R"],
                        action: function (event) {
                            event.preventDefault();
                            container.tabIcon.indexText.select();
                        }
                    });

                    menu.addItem(Platform.i18n.get("window_close"), {
                        keys: ["C"],
                        action: closeWindow
                    });

                    menu.separator();


                    function inqueue(menu) {
                        if (container.tabList.queue.length) {
                            menu.enable();
                        } else {
                            menu.disable();
                        }
                    }

                    function some(func) {
                        return function (menu) {
                            var some = container.tabList.queue.some(func);

                            if (some) {
                                menu.enable();
                            } else {
                                menu.disable();
                            }
                        };
                    }

                    function message(range, info) {
                        if (Options.get(info.option)) {
                            Undo.push(info.name, info.info);

                            var text = [];

                            text.push(Platform.i18n.get(info.message));

                            text.push(range.length);

                            text.push(Platform.i18n.get("global_tab"));

                            if (range.length !== 1) {
                                text.push(Platform.i18n.get("global_plural"));
                            }

                            text.push(Platform.i18n.get("global_end"));

                            state.undoBar.show(text.join(""));
                        }
                    }

                    function action(info) {
                        return function () {
                            var range = container.tabList.queue.filter(info.filter);

                            if (range.length) {
                                message(range, {
                                    option: info.option,
                                    name: info.name,
                                    info: info.info(range),
                                    message: info.message
                                });

                                state.search.delay(1000);

                                info.action(range);
                            }

                            container.tabList.queue.reset();
                            delete container.tabList.queue.shiftNode;
                        };
                    }


                    menu.addItem(Platform.i18n.get("window_menu_select_all"), {
                        keys: ["A"],
                        onshow: function (menu) {
                            var queue = container.tabList.queue.length;
                            var tabs = container.tabList.children.length;

                            if (queue === tabs) {
                                menu.disable();
                            } else {
                                menu.enable();
                            }
                        },
                        action: function () {
//                            var old = container.tabList.queue.slice();
//
                            var range = [];

                            Array.slice(container.tabList.children).forEach(function (item) {
                                if (!item.hasAttribute("hidden")) {
                                    if (!item.hasAttribute("data-selected")) {
                                        range.push(item);
                                        item.queueAdd();
                                    }
                                }
                            });
/*
                            var range = container.tabList.queue.filter(function (item) {
                                item.undoState.selected = item.hasAttribute("data-selected");
                                return !item.undoState.selected;
                            });*/

                            if (range.length) {
                                message(range, {
                                    option: "undo.select-tabs",
                                    name: "select-tabs",
                                    info: {
                                        queue: container.tabList.queue,
                                        type: "select",
                                        list: range
                                    },
                                    message: "undo_message_selected"
                                });
                            }
/*
                                range.forEach(function (item) {
                                    item.queueAdd();
                                });*/
//                            }

//                            container.tabList.queue.reset();
                            delete container.tabList.queue.shiftNode;
                        }
                    });

                    menu.addItem(Platform.i18n.get("window_menu_select_none"), {
                        keys: ["N"],
                        onshow: inqueue,
                        action: function () {
//                            var old = container.tabList.queue.slice();
//
                            var range = [];

                            Array.slice(container.tabList.children).forEach(function (item) {
                                if (!item.hasAttribute("hidden")) {
                                    if (item.hasAttribute("data-selected")) {
                                        range.push(item);
                                        item.queueRemove();
                                    }
                                }
                            });
/*
                            var range = container.tabList.queue.filter(function (item) {
                                item.undoState.selected = item.hasAttribute("data-selected");
                                return !item.undoState.selected;
                            });*/

                            if (range.length) {
                                message(range, {
                                    option: "undo.select-tabs",
                                    name: "select-tabs",
                                    info: {
                                        queue: container.tabList.queue,
                                        type: "unselect",
                                        list: range
                                    },
                                    message: "undo_message_unselected"
                                });
                            }
/*
                                range.forEach(function (item) {
                                    item.queueAdd();
                                });*/
//                            }

//                            container.tabList.queue.reset();
                            delete container.tabList.queue.shiftNode;
                        }
                    });

                    menu.separator();

                    menu.submenu(Platform.i18n.get("window_menu_selected"), {
                        keys: ["S"],
                        onshow: inqueue,
                        create: function (menu) {
                            menu.addItem(Platform.i18n.get("window_menu_selected_reload"), {
                                keys: ["L"],
                                action: function () {
                                    state.search.delay(1000);

                                    container.tabList.queue.forEach(function (item) {
                                        Platform.tabs.update(item.tab, { url: item.tab.url });
                                    });

                                    container.tabList.queue.reset();
                                    delete container.tabList.queue.shiftNode;
                                }
                            });


                            menu.addItem(Platform.i18n.get("window_menu_selected_close"), {
                                keys: ["C"],
                                action: function () {
                                    state.search.delay(1000);

                                    container.tabList.queue.forEach(function (item) {
                                        Platform.tabs.remove(item.tab);
                                    });

                                    container.tabList.queue.reset();
                                    delete container.tabList.queue.shiftNode;
                                }
                            });

                            menu.separator();

                            menu.addItem(Platform.i18n.get("window_menu_selected_pin"), {
                                keys: ["P"],
                                onshow: some(function (item) {
                                    return !item.tab.pinned;
                                }),
                                action: action({
                                    filter: function (item) {
                                        item.undoState.pinned = item.tab.pinned;
                                        return !item.undoState.pinned;
                                    },
                                    option: "undo.pin-tabs",
                                    name: "pin-tabs",
                                    info: function (range) {
                                        return {
                                            queue: container.tabList.queue.slice(),
                                            type: "pin",
                                            list: range
                                        };
                                    },
                                    message: "undo_message_pinned",
                                    action: function (range) {
                                        range.forEach(function (item) {
                                            Platform.tabs.update(item.tab, { pinned: true });
                                        });
                                    }
                                })
                            });

                            menu.addItem(Platform.i18n.get("window_menu_selected_unpin"), {
                                keys: ["U"],
                                onshow: some(function (item) {
                                    return item.tab.pinned;
                                }),
                                action: action({
                                    filter: function (item) {
                                        item.undoState.pinned = item.tab.pinned;
                                        return item.undoState.pinned;
                                    },
                                    option: "undo.pin-tabs",
                                    name: "pin-tabs",
                                    info: function (range) {
                                        return {
                                            queue: container.tabList.queue.slice(),
                                            type: "unpin",
                                            list: range
                                        };
                                    },
                                    message: "undo_message_unpinned",
                                    action: function (range) {
                                        range.rightForEach(function (item) {
                                            Platform.tabs.update(item.tab, { pinned: false });
                                        });
                                    }
                                })
                            });

                            menu.separator();

                            menu.addItem(Platform.i18n.get("window_menu_selected_favorite"), {
                                keys: ["F"],
                                onshow: some(function (item) {
                                    return !item.hasAttribute("data-favorited");
                                }),
                                action: action({
                                    filter: function (item) {
                                        item.undoState.favorited = item.hasAttribute("data-favorited");
                                        return !item.undoState.favorited;
                                    },
                                    option: "undo.favorite-tabs",
                                    name: "favorite-tabs",
                                    info: function (range) {
                                        return {
                                            queue: container.tabList.queue.slice(),
                                            list: range
                                        };
                                    },
                                    message: "undo_message_favorited",
                                    action: function (range) {
                                        range.forEach(function (item) {
                                            var url = item.tab.url;
                                            state.favorites.set(url, state.tabsByURL[url].length);
                                        });
                                    }
                                })
                            });

                            menu.addItem(Platform.i18n.get("window_menu_selected_unfavorite"), {
                                keys: ["N"],
                                onshow: some(function (item) {
                                    return item.hasAttribute("data-favorited");
                                }),
                                action: action({
                                    filter: function (item) {
                                        item.undoState.favorited = item.hasAttribute("data-favorited");
                                        return item.undoState.favorited;
                                    },
                                    option: "undo.favorite-tabs",
                                    name: "favorite-tabs",
                                    info: function (range) {
                                        return {
                                            queue: container.tabList.queue.slice(),
                                            list: range
                                        };
                                    },
                                    message: "undo_message_unfavorited",
                                    action: function (range) {
                                        range.forEach(function (item) {
                                            state.favorites.set(item.tab.url, null);
                                        });
                                    }
                                })
                            });
                        }
                    });

                    menu.separator();

                    menu.submenu(Platform.i18n.get("window_menu_move_selected_to"), {
                        keys: ["M"],
                        onshow: inqueue,
                        onopen: function (menu) {
                            menu.clear();

                            menu.addItem(Platform.i18n.get("toolbar_menu_new_window"), {
                                keys: ["N"],
                                action: function () {
                                    state.search.delay(1000);

                                    Window.create(container.tabList.queue);
                                }
                            });

                            if (state.sorted.length) {
                                menu.separator();

                                state.sorted.forEach(function (item, i) {
                                    var name = item.window.title;
                                    if (item === container) {
                                        name = "<strong>" + name + "</strong>";
                                    }

                                    menu.addItem(name, {
                                        action: function () {
                                            state.search.delay(1000);

                                            container.tabList.queue.moveTabs(item.window);
                                        }
                                    });
                                });
                            }
                        }
                    });
                });

                element.appendChild(contextMenu);
            });

            container.appendChild(container.dropdown);


            container.appendChild(UI.create("div", function (element) {
                element.className = "tab-list-border";

                container.tabContainer = element;

                element.appendChild(UI.create("div", function (list) {
                    list.className = "tab-list";
                    list.tabIndex = 1;

                    list.container = container;
                    list.queue = [];

                    container.tabList = list;

                    /*! var update = function anon(event) {
                        clearTimeout(anon.timeout);

                        var self = this;
                        anon.timeout = setTimeout(function () {
                            container.tabIcon.title = "Tabs: " + self.children.length;
                        }, 2000);
                    };
                    list.addEventListener("DOMNodeInserted", update, true);
                    list.addEventListener("DOMNodeRemoved", update, true);*/

                    if (win.tabs) {
                        win.tabs.forEach(function (tab) {
                            list.appendChild(Tab.proxy(tab));
                        });
                    }
                }));
            }));
        }));

        return fragment;
    }
};
