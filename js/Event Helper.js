"use strict";
/*global Options, Platform, state, Tab, UI, Window */

var events = {
    disable: function (event) {
        event.preventDefault();
    },
    stop: function (event) {
        event.stopPropagation();
    }
};


var action = {
    returnTitle: function (index) {
        var value = state.titles[index];
        return (value) ? value : index + 1;
    },


    unselectWindow: function () {
        var query = document.querySelector(".window[data-focused]");
        if (query) {
            query.removeAttribute("data-focused");
        }
    },


    attachEvents: function (element) {
        Platform.event.on("window-create", function (win) {
            if (win.type === "normal") {
                element.appendChild(Window.proxy(win));

                state.search({ nodelay: true }); //! Prevents jittering
            }
        });

        Platform.event.on("tab-create", function (tab) {
            var node, tabs, list = state.windows[tab.windowId];

            if (list) {
                list.updateTooltip();

                tabs = list.tabList;
                if (tabs) {
                    node = Tab.proxy(tab);
                    tabs.moveChild(node, tab.index);

                    state.search({ scroll: true, tabs: [node] });
                }
            }
        });

        Platform.event.on("tab-update", function (tab, old) {
            var list, node = state.tabsByID[tab.id];

            if (node && (list = node.parentNode)) {
                state.tabsByURL.remove(old.url, node);

                node.update(tab);
//
//                var selected = node.hasAttribute("data-selected");
//
//                console.log(node);
//
//                var element = Tab.proxy(tab);
//                list.replaceChild(element, node);
//
//                if (selected) {
//                    element.queueAdd();
//                }

                state.search({ tabs: [node] });
            }
        });

        Platform.event.on("tab-move", function (tab) {
            var list = state.windows[tab.windowId],
                node = state.tabsByID[tab.id];

            if (list && node && (list = list.tabList)) {
                if (node.parentNode === list) {
                    list.removeChild(node);
                }
                list.moveChild(node, tab.index);

                //! UI.scrollTo(node, list);
            }
        });

        Platform.event.on("tab-detach", function (tab) {
            var tabs, list = state.windows[tab.windowId];

            if (list) {
                list.updateTooltip();

                tabs = list.tabList;
                if (tabs) {
                    delete tabs.queue.shiftNode;
                }
            }
        });

        Platform.event.on("tab-attach", function (tab) {
            var list = state.windows[tab.windowId],
                node = state.tabsByID[tab.id];

            if (list && node) {
                list.updateTooltip();

                list = list.tabList;
                if (list) {
                    node.removeAttribute("data-focused");
                    list.moveChild(node, tab.index);

                    node.tab.windowId = tab.windowId;

                    state.search({ scroll: true, tabs: [node] });
                }
            }
        });

        state.event.on("tab-focus", function (tab) {
            var list = state.windows[tab.windowId],
                node = state.tabsByID[tab.id];

            if (list && node) {
                var scroll = list.tabList;

                if ((list = list.querySelector("[data-focused]"))) {
                    list.removeAttribute("data-focused");
                    list.triggerEvent("Platform-blur", false, false);
                }
                node.setAttribute("data-focused", "");
                node.scrollIntoViewIfNeeded(false);

                if (!node.nextSibling) {
                    scroll.scrollTop += 9001;
                } else if (!node.previousSibling) {
                    scroll.scrollTop -= 9001;
                }
                //! UI.scrollTo(node, node.parentNode);

                node.triggerEvent("Platform-focus", false, false);
            }
        });

        Platform.event.on("tab-focus", function (tab) {
            state.event.trigger("tab-focus", tab);
            state.search({ tabs: [/*!node*/] });
        });

        Platform.event.on("tab-indent", function (tab, indent) {
            var node = state.tabsByID[tab.id];
            if (node) {
                node.indent(indent);
            }
        });

        Platform.event.on("tab-remove", function (tab) {
            var list = state.windows[tab.windowId],
                node = state.tabsByID[tab.id];

            if (node && list) {
                list.updateTooltip();

                list = list.tabList;
                if (list) {
                    state.tabsByURL.remove(node.tab.url, node);

                    list.removeChild(node);

                    state.search({ tabs: [] });
                }
            }
            delete state.tabsByID[tab.id];
        });

        Platform.event.on("window-remove", function (win) {
            var list = state.windows[win.id];

            if (list && list.parentNode) {
                list.parentNode.removeChild(list);

                var index = state.list.indexOf(list);
                if (index !== -1) {
                    state.list.splice(index, 1);
                    state.titles.splice(index, 1);
                }
            }
            delete state.windows[win.id];

            state.list.forEach(function (item, i) {
                item.tabIcon.indexText.value = action.returnTitle(i);
            });

            state.search({ nodelay: true, tabs: [] });
        });
    }
};
