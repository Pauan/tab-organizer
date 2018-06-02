/*global Element */

var UI = (function () {
    "use strict";

    return {
        create: function (name, initialize) {
            var element = document.createElement(name);
            if (typeof initialize === "function") {
                initialize(element);
            }
            return element;
        },


        link: function (initialize) {
            var element = document.createElement("button");
            element.className = "UI-link";

            if (typeof initialize === "function") {
                initialize(element);
            }

            if (element.href) {
                element.addEventListener("click", function anon() {
                    anon.popup = open(this.href, this.target);
                }, true);
            }

            return element;
        },


        scrollTo: function (node, parent) {
            parent.scrollLeft = node.offsetLeft - (parent.clientWidth / 2) + (node.offsetWidth / 2) + 4; //! + 3
            parent.scrollTop = node.offsetTop - (parent.clientHeight / 2) + (node.offsetHeight / 2) + 4; //! + 3
        },


        scrollIntoView: function (node, parent) {
            var rect = node.getBoundingClientRect();
            parent.scrollLeft += rect.left - (parent.clientWidth / 2) + (rect.width / 2);

            var height = document.documentElement.clientHeight;
            parent.scrollTop += rect.top - (height / 2) + (rect.height / 2) - 29; //! - 26 // 32 // 40
        },


        modal: (function () {
            var modal = document.createElement("div");
            modal.title = "\x00";

            modal.style.position = "fixed !important";
            modal.style.left = modal.style.top = "0px !important";
            modal.style.width = modal.style.height = "100% !important";
            modal.style.cursor = "default !important";

            var info = {};

            return function (element, action) {
                if (element instanceof Element) {
                    var parent = element.parentNode;

                    info.parent = parent;
                    info.zIndex = parent.style.zIndex;

                    parent.style.zIndex = "9002 !important";
                    parent.insertBefore(modal, element);

                    var trigger = document.createEvent("Event");
                    trigger.initEvent("UI-modal-on", false, false);
                    element.dispatchEvent(trigger);

                    var drag, remove, keydown;

                    drag = function (event) {
                        modal.style.display = "none !important";
                        var target = document.elementFromPoint(event.clientX, event.clientY);
                        modal.style.display = "";

                        if (!parent.contains(target)) {
                            remove();
                        }
                    };

                    remove = function (event) {
                        modal.removeEventListener("dragover", drag, true);
                        modal.removeEventListener("contextmenu", remove, true);
                        modal.removeEventListener("click", remove, true);
                        removeEventListener("keydown", keydown, true);

                        if (event) {
                            event.preventDefault();
                        }

                        parent.style.zIndex = info.zIndex;

                        if (modal.parentNode) {
                            modal.parentNode.removeChild(modal);
                        }

                        if (typeof action === "function") {
                            action();
                        }

                        var trigger = document.createEvent("Event");
                        trigger.initEvent("UI-modal-off", false, false);
                        element.dispatchEvent(trigger);
                    };

                    keydown = function (event) {
                        if (event.which === 27) {
                            remove(event);
                        }
                    };
                    addEventListener("keydown", keydown, true);

                    modal.addEventListener("dragover", drag, true);
                    modal.addEventListener("contextmenu", remove, true);
                    modal.addEventListener("click", remove, true);


                } else if (info.parent) {
                    var event = document.createEvent("Event");
                    event.initEvent("click", false, false);
                    modal.dispatchEvent(event);
                    info.parent = null;
                }
            };
        }()),


        contextMenu: function (initialize) {
            var container = document.createElement("ul");
            container.className = "UI-contextMenu";
            container.title = "\x00";
            container.keys = {};

            container.setAttribute("hidden", "");

            container.addEventListener("contextmenu", function (event) {
                event.preventDefault();
            }, true);


            function close() {
                UI.modal(null);
            }

            function findEnabled(element, forward) {
                var next = (forward
                             ? element.previousSibling
                             : element.nextSibling);

                if (!next) {
                    return null;
                }

                if (next.localName !== "li" || next.hasAttribute("data-disabled")) {
                    return findEnabled(next, forward);
                } else {
                    return next;
                }
            }

            function unhover() {
                var query = container.querySelector(".UI-contextMenu-item[data-selected]");
                if (query) {
                    query.removeAttribute("data-selected");
                }
            }

            function select() {
                var query = container.querySelector("[data-selected]");

                if (query && !query.contains(this)) {
                    query.removeAttribute("data-selected");
                }

                this.setAttribute("data-selected", "");
            }

            function unselect() {
                this.removeAttribute("data-selected");
            }

            function keydown(event) {
                event.preventDefault();
                event.stopPropagation();

                var item, next, query, submenu, trigger;

                if (event.which === 38 || event.which === 40) { //* Up/Down
                    query = container.querySelector("[data-selected]");

                    if (query) {
                        if (query.className === "UI-contextMenu-submenu") {
                            item = query.querySelector(".UI-contextMenu-item[data-selected]");
                            if (item) {
                                query = item;
                            }
                        }
                        next = findEnabled(query, event.which === 38);
                    } else if (event.which === 40) {
                        next = container.firstChild;
                    }

                    if (next) {
                        if (next.className === "UI-contextMenu-submenu") {
                            trigger = document.createEvent("Event");
                            trigger.initEvent("UI-selected", false, false);
                            next.dispatchEvent(trigger);
                        }

                        next.setAttribute("data-selected", "");
                        next.scrollIntoViewIfNeeded(false);

                        if (!next.previousSibling) {
                            next.parentNode.scrollTop -= 9001;
                        } else if (!next.nextSibling) {
                            next.parentNode.scrollTop += 9001;
                        }

                        if (query) {
                            query.removeAttribute("data-selected");
                        }
                    }
                } else if (event.which === 37 || event.which === 39) { //* Left/Right
                    submenu = container.querySelector(".UI-contextMenu-submenu[data-selected]");
                    if (submenu) {
                        if (event.which === 37) {
                            unhover();
                        } else {
                            query = submenu.list.querySelector(".UI-contextMenu-item[data-selected]");

                            if (!query) {
                                var child = submenu.list.firstChild;
                                if (child) {
                                    child.setAttribute("data-selected", "");
                                }
                            }
                        }
                    }
                } else if (event.which === 13 || event.which === 32) { //* Enter/Space
                    query = container.querySelector(".UI-contextMenu-item[data-selected]");
                    if (query) {
                        trigger = document.createEvent("Event");
                        trigger.initEvent("mouseup", false, false);
                        query.dispatchEvent(trigger);
                    }
                } else {
                    var keys = container.keys;

                    submenu = container.querySelector(".UI-contextMenu-submenu[data-selected]");
                    if (submenu) {
                        if (submenu.querySelector(".UI-contextMenu-item[data-selected]")) {
                            keys = submenu.list.keys;
                        }
                    }

                    var info = keys[String.fromCharCode(event.which)];
                    if (info && !info.item.hasAttribute("data-disabled")) {
                        if (typeof info.action === "function") {
                            unhover();
                            info.action(event);
                        }
                    }
                }
            }


            var root = document.documentElement;

            var menu = {
                "DOM.Element": container,

                clear: function () {
                    var parent = this["DOM.Element"];
                    while (parent.firstChild) {
                        parent.removeChild(parent.firstChild);
                    }
                },

                hide: close,

                show: function (info) {
                    if (!container.hasAttribute("hidden")) {
                        return;
                    }

                    info = Object(info);

                    if ("x" in info || "y" in info) {
                        container.style.position = "fixed";
                        container.style.left = info.x + 5 + "px";
                        container.style.top = info.y + 7 + "px";
                    }

                    container.removeAttribute("hidden");

                    var width = container.offsetWidth;
                    var height = container.offsetHeight;

                    if (width + info.x > root.clientWidth) {
                        container.style.left = info.x - width - 2 + "px";
                    }
                    if (height + info.y > root.clientHeight) {
                        container.style.top = info.y - height + "px";
                    }

                    addEventListener("keydown", keydown, true);
                    addEventListener("dragend", close, true);

                    UI.modal(container, function () {
                        removeEventListener("keydown", keydown, true);
                        removeEventListener("dragend", close, true);

                        container.setAttribute("hidden", "");

                        if (typeof info.onhide === "function") {
                            info.onhide();
                        }

                        unhover();

                        container.style.position = "";
                        container.style.left = "";
                        container.style.top = "";
                    });
                },


                submenu: function (name, info) {
                    info = Object(info);

                    var parent = this["DOM.Element"];

                    var item = document.createElement("li");
                    item.className = "UI-contextMenu-submenu";
                    item.innerHTML = name;

                    var padding = document.createElement("div");
                    padding.className = "UI-contextMenu-submenu-padding";

                    var list = document.createElement("ul");
                    list.className = "UI-contextMenu-submenu-list";
                    list.keys = {};

                    item.list = list;

                    var mask = document.createElement("div");
                    mask.className = "UI-contextMenu-submenu-mask";

                    var image = document.createElement("img");
                    image.className = "UI-contextMenu-arrow";
                    image.src = "/images/context-menu-arrow.png";

                    container.addEventListener("UI-modal-off", function () {
                        item.removeAttribute("data-selected");
                    }, true);


                    var clone = Object.create(menu, {
                        "DOM.Element": { value: list }
                    });

                    item.addEventListener("UI-selected", function (event) {
                        if (!item.hasAttribute("data-selected")) {
                            if (typeof info.onopen === "function") {
                                info.onopen(clone);
                            }
                        }

                        padding.removeAttribute("data-overflow-x");

                        list.style.overflowY = "";
                        padding.style.maxWidth = "";
                        padding.style.height = "";
                        padding.style.top = "";

                        var box = padding.getBoundingClientRect();

                        if (box.width > root.clientWidth) {
                            padding.style.maxWidth = root.clientWidth - box.left + "px";
                        } else if (box.right > root.clientWidth) {
                            padding.setAttribute("data-overflow-x", "");
                        }

                        if (box.height > root.clientHeight) {
                            padding.style.height = root.clientHeight + "px";
                            padding.style.top = -box.top + "px";
                        } else {
                            list.style.overflowY = "visible";

                            if (box.bottom > root.clientHeight) {
                                padding.style.top = root.clientHeight - box.bottom + "px";
                            }
                        }
                    }, true);

                    function hoverin(event) {
                        if (event.target === item) {
                            var trigger = document.createEvent("Event");
                            trigger.initEvent("UI-selected", false, false);
                            item.dispatchEvent(trigger);

                            select.call(item);
                        }
                    }

                    clone.disable = function () {
                        item.removeEventListener("mouseover", hoverin, true);
                        item.setAttribute("data-disabled", "");
                    };

                    clone.enable = function () {
                        item.addEventListener("mouseover", hoverin, true);
                        item.removeAttribute("data-disabled");
                    };
                    clone.enable();


                    container.addEventListener("UI-modal-on", function () {
                        if (typeof info.onshow === "function") {
                            info.onshow(clone);
                        }
                        padding.style.height = "0px";
                    }, true);


                    if (info.keys instanceof Array) {
                        info.keys.forEach(function (key) {
                            parent.keys[key] = {
                                item: item,
                                action: function () {
                                    parent.addEventListener("mouseover", function anon(event) {
                                        if (!item.contains(event.relatedTarget)) {
                                            this.removeEventListener(event.type, anon, true);
                                            item.removeAttribute("data-selected");
                                        }
                                    }, true);

                                    hoverin({ target: item });

                                    var child = list.firstChild;
                                    if (child) {
                                        child.setAttribute("data-selected", "");
                                    }
                                }
                            };
                        });
                    }

                    if (typeof info.create === "function") {
                        info.create(clone);
                    }

                    padding.appendChild(list);
                    item.appendChild(image);
                    item.appendChild(padding);
                    item.appendChild(mask);
                    parent.appendChild(item);
                },


                addItem: function (name, info) {
                    info = Object(info);

                    var parent = this["DOM.Element"];

                    var item = document.createElement("li");
                    item.className = "UI-contextMenu-item";
                    item.innerHTML = name;

                    function modal(event) {
                        UI.modal(null);
                        info.action(event);
                    }

                    if (info.keys instanceof Array) {
                        info.keys.forEach(function (key) {
                            parent.keys[key] = {
                                action: modal,
                                item: item
                            };
                        });
                    }

                    var actions = {
                        enable: function () {
                            item.addEventListener("mouseup", modal, true);
                            item.addEventListener("contextmenu", modal, true);
                            item.addEventListener("mouseover", select, true);
                            item.addEventListener("dragenter", select, true);
                            item.addEventListener("mouseout", unselect, true);
                            item.addEventListener("dragleave", unselect, true);

                            item.removeAttribute("data-disabled");
                        },
                        disable: function () {
                            item.removeEventListener("mouseup", modal, true);
                            item.removeEventListener("contextmenu", modal, true);
                            item.removeEventListener("mouseover", select, true);
                            item.removeEventListener("dragenter", select, true);
                            item.removeEventListener("mouseout", unselect, true);
                            item.removeEventListener("dragleave", unselect, true);

                            item.setAttribute("data-disabled", "");

                            unselect.call(item);
                        }
                    };
                    actions.enable();

                    if (typeof info.onshow === "function") {
                        container.addEventListener("UI-modal-on", function () {
                            info.onshow(actions);
                        }, true);
                    }

                    if (typeof info.ondrop === "function") {
                        item.addEventListener("drop", info.ondrop, true);
                        item.addEventListener("dragover", function (event) {
                            event.preventDefault();
                        }, true);
                    }

                    if (typeof info.create === "function") {
                        info.create(item);
                    }

                    parent.appendChild(item);
                    return actions;
                },


                separator: function () {
                    var item = document.createElement("hr");
                    item.className = "UI-contextMenu-separator";

                    this["DOM.Element"].appendChild(item);
                },


                space: function () {
                    var item = document.createElement("div");
                    item.className = "UI-contextMenu-space";

                    this["DOM.Element"].appendChild(item);
                }
            };


            if (typeof initialize === "function") {
                initialize(menu);
            }

            return container;
        },


        scrollBar: function (parent, info) {
            info = Object(info);

            var scroller = document.createElement("div");
            scroller.className = "UI-scrollBar";

            if (info.side === "left") {
                scroller.style.left = "0px";
            } else {
                scroller.style.right = "0px";
            }

            scroller.appendChild(UI.create("div", function (element) {
                element.className = "UI-scrollBar-marker";
            }));

            scroller.appendChild(UI.create("div", function (element) {
                element.className = "UI-scrollBar-track";

                function height() {
                    return (element.offsetHeight / scroller.offsetHeight) * 100;
                }

                function center() {
                    return ((element.offsetHeight / scroller.offsetHeight) / 2) * 100;
                }

                function cap(number) {
                    return Math.min(Math.max(number, 0), 100 - height());
                }

        /*!
                state.video.addEventListener("timeupdate", function () {
                    var width = div.offsetWidth - slider.offsetWidth;
                    var point = this.currentTime / this.duration;
                    var percentage = (width + 1) / div.offsetWidth;

                    slider.style.left = point * 100 * percentage + "%";
                }, true);
        */
                var state = {};

                scroller.addEventListener("KAE-dragstart", function anon(event) {
                    parent.scrollTop += state.y;

                    state.timer = setTimeout(anon, 25);
                }, true);

                scroller.addEventListener("KAE-drag", function (event) {
                    if (event.button === 0) {
                        element.style.webkitTransition = "";

                        var box = scroller.getBoundingClientRect();

                        var middle = center();

                        var number = cap(event.clientY / box.height * 100 - middle);

                        state.y = (number - (50 - middle));

                        element.style.top = number + "%";
                    } else {
                        event.preventDefault();
                    }
                }, true);

                function normalize(event) {
                    element.style.top = 50 - center() + "%";
                }
                setTimeout(normalize, 0);

                scroller.addEventListener("KAE-dragend", function () {
                    clearTimeout(state.timer);

                    element.style.webkitTransition = "top, 0.5s";
                    normalize();
                }, true);
            }));

            parent.insertBefore(scroller, parent.firstChild);
        }
    };
}());


(function () {
    "use strict";

    function mouseEvent(element, name, info) {
        var event = document.createEvent("MouseEvents");

        event.initMouseEvent(name, true, true, info.view, info.detail,
            info.screenX, info.screenY, info.clientX, info.clientY,
            info.ctrlKey, info.altKey, info.shiftKey, info.metaKey,
            info.button, info.target);

        return element.dispatchEvent(event);
    }

    function dragstart(event) {
        mouseEvent(event.target, "KAE-dragstart", event);
        mouseEvent(event.target, "KAE-drag", event);
    }

    addEventListener("mousedown", dragstart, false);

    addEventListener("KAE-dragstart", function (event) {
        var element = event.target;

        function drag(event) {
            mouseEvent(element, "KAE-dragmove", event);
            mouseEvent(element, "KAE-drag", event);
        }
        function dragend(event) {
            mouseEvent(element, "KAE-dragend", event);
        }

        if (!event.defaultPrevented) {
            addEventListener("mousemove", drag, false);
            addEventListener("mouseup", dragend, false);

            addEventListener("KAE-dragend", function anon(event) {
                if (!event.defaultPrevented) {
                    this.removeEventListener(event.type, anon, false);

                    removeEventListener("mousemove", drag, false);
                    removeEventListener("mouseup", dragend, false);

                    console.assert(!anon.hasRun);
                    anon.hasRun = true;
                }
            }, false);
        }
    }, false);
}());
