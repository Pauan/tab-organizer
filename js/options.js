"use strict";
/*global Options, UI */

Options.createContainer(function (container) {
    function trigger(element) {
        var event = document.createEvent("Event");
        event.initEvent("Options-update", false, false);
        element.dispatchEvent(event);
    }

    function checkboxbutton(info) {
        info = Object(info);

        return UI.create("button", function (container) {
            container.title = "Select all / none";
            container.className = "Options-button";
            container.style.padding = "0px 8px 0px 4px";
            container.style.marginLeft = "3px";
            container.style.height = "25px";

            container.appendChild(UI.create("input", function (element) {
                element.type = "checkbox";
                element.style.cursor = "pointer";

                info.create(element);

                function all() {
                    var boxes = info.container.querySelectorAll("input[type=checkbox]");
                    for (var i = 0; i < boxes.length; i += 1) {
                        boxes[i].checked = true;
                    }
                    element.checked = true;
                    element.style.opacity = "";

                    info.update(element);
                }

                function none() {
                    var boxes = info.container.querySelectorAll("input[type=checkbox]");
                    for (var i = 0; i < boxes.length; i += 1) {
                        boxes[i].checked = false;
                    }
                    element.checked = false;
                    element.style.opacity = "";

                    info.update(element);
                }

                element.addEventListener("change", function () {
                    if (this.checked) {
                        all();
                    } else {
                        none();
                    }
                }, true);

                container.appendChild(UI.contextMenu(function (menu) {
                    menu["DOM.Element"].style.marginTop = "-3px";
                    menu["DOM.Element"].style.marginLeft = "-6px";

                    function show(event) {
                        if (event.target === element) {
                            return;
                        } else if (menu["DOM.Element"].contains(event.target)) {
                            return;
                        }

                        if (event.button !== 2) {
                            menu.show();
                        }
                    }
                    container.addEventListener("mousedown", show, true);
                    container.addEventListener("click", show, true);

                    menu.addItem("<u>A<\/u>ll", {
                        keys: ["A"],
                        action: all
                    });

                    menu.addItem("<u>N<\/u>one", {
                        keys: ["N"],
                        action: none
                    });
                }));
            }));

            container.appendChild(UI.create("img", function (element) {
                element.src = "/themes/Black-button-menu.png";
                element.style.paddingLeft = "2px";
                element.style.paddingBottom = "3px";
            }));
        });
    }


    var categories = {
        "Counter": function (container) {
            container.group(function (container) {
                container.input("checkbox", {
                    option: "counter.enabled",
                    text: "Display a counter that shows how many tabs "
                });

                container.input("dropdown-list", {
                    option: "counter.type",
                    list: [{
                        value: "total",
                        text: "you have in total (does not reset)"
                    }, {
                        value: "session",
                        text: "you have opened/closed per session"
                    }]
                });
            });

            container.space({ height: "0.8em" });

            container.indent(function (container) {
                container.header(function (container) {
                    container.input("number", {
                        option: "counter.reset.number",
                        text: "Reset the session to ",
                        unit: "when...",
                        width: "2em"
                    });
                });

                container.indent(function (container) {
                    container.group(function (container) {
                        container.input("checkbox", {
                            option: "counter.reset.time",
                            text: "...it is "
                        });
                        container.input("number", {
                            option: "counter.reset.time.hour",
                            width: "2em",
                            unit: ":",
                            limit: {
                                min: 0,
                                max: 23,
                                digits: 2
                            }
                        });
                        container.input("number", {
                            option: "counter.reset.time.minute",
                            unit: "o'clock",
                            width: "2em",
                            limit: {
                                min: 0,
                                max: 59,
                                digits: 2
                            }
                        });
                    });

                    container.group(function (container) {
                        container.input("checkbox", {
                            option: "counter.reset.idle",
                            text: "...idle for "
                        });
                        container.input("number", {
                            option: "counter.reset.idle.hour",
                            width: "2em",
                            unit: "hours",
                            limit: {
                                min: 0
                            }
                        });
                    });
                });

                container.space({ height: "0.75em" });

                container.input("checkbox", {
                    option: "counter.reset.whenlower",
                    text: "Only reset when the counter is lower than the reset number"
                });
            });

            container.space({ height: "0.9em" });

            container.button({
                text: "Reset counter",
                height: "27px",
                action: function () {
                    Options.get("counter.state").reset(true);
                }
            });
        },


        "Experimental": function (container) {
            container.text("Experimental features are disabled by default. Possibly because they break things, or I'm not sure how useful they are, or because they change the behavior of Tab Organizer significantly.");

            container.space({ height: "1em" });

            container.text("These features might be removed or changed at any time.");

            container.separator();
            container.space({ height: "1em" });

            container.input("checkbox", {
                option: "windows.middle-close",
                text: "Middle click on a window's title to close the entire window"
            });

            container.input("checkbox", {
                option: "popup.close.escape",
                text: "Use the Escape key to close the popup"
            });
        },


        "Favorites": function (container) {
            var favorites = Options.get("tabs.favorites.urls");
            var array = [];
            var rows = {};

            container["DOM.Element"].style.display = "-webkit-box";
            container["DOM.Element"].style.webkitBoxOrient = "vertical";
            container["DOM.Element"].style.webkitBoxPack = "center";

            var header = UI.create("div", function (element) {
                element.style.display = "-webkit-box";
                element.style.padding = "6px 13px 1px 7px";
                element.style.fontWeight = "bold";

                element.appendChild(UI.create("div", function (element) {
                    element.style.visibility = "hidden";

                    element.appendChild(UI.create("input", function (element) {
                        element.type = "checkbox";
                        element.style.marginTop = "1px !important";
                    }));
                }));

                element.appendChild(UI.create("div", function (element) {
                    element.textContent = "URL";
                    element.style.webkitBoxFlex = "1";
                }));

                element.appendChild(UI.create("div", function (element) {
                    element.textContent = "Tabs";
                }));
            });

            var placeholder = UI.create("div", function (element) {
                element.textContent = "You haven't added any tabs to your favorites";
                element.style.textAlign = "center";
                element.style.paddingTop = "15px";
            });

            var table = UI.create("div", function (table) {
                table.style.webkitBoxFlex = "1";
                table.style.paddingBottom = "6px";
                table.style.overflowX = "hidden";
                table.style.overflowY = "auto";
                table.style.whiteSpace = "nowrap";

                function makeRow(info) {
                    return UI.create("div", function (container) {
                        container.style.display = "-webkit-box";
                        container.style.padding = "2px";
                        container.style.paddingLeft = "7px";
                        container.style.paddingRight = "13px";

                        var tabs = document.createElement("div");

                        rows[info.url] = container;

                        container.update = function (info) {
                            if (info.tabs === 0) {
                                container.style.backgroundColor = "salmon";
                            } else {
                                container.style.backgroundColor = "";
                            }

                            tabs.textContent = info.tabs;
                            container.info = info;
                        };
                        container.update(info);


                        container.appendChild(UI.create("label", function (element) {
                            element.style.webkitBoxFlex = "1";
                            element.style.display = "block";
                            element.style.overflow = "hidden";
                            element.style.textOverflow = "ellipsis";

                            element.appendChild(UI.create("input", function (element) {
                                element.type = "checkbox";
                                element.style.marginTop = "1px !important";

                                container.checkbox = element;

                                element.addEventListener("change", function () {
                                    trigger(table);
                                }, true);
                            }));

                            element.appendChild(UI.create("span", function (element) {
                                element.textContent = info.url;
                            }));
                        }));

                        container.appendChild(tabs);

/*!
                            element.appendChild(UI.create("img", function (element) {
                                element.src = "/images/button-close.png";

                                element.addEventListener("click", function () {
                                    favorites.set(info.url, null);
//                                            delete favorites[info.url];

//                                            Options.event.trigger("change", {
//                                                name: "tabs.favorites.urls",
//                                                value: info.url,
//                                                remove: true
//                                            });
                                }, true);

                                function show() {
                                    element.style.visibility = "";
                                }
                                function hide() {
                                    element.style.visibility = "hidden !important";
                                }
                                hide();

                                container.addEventListener("mouseover", show, true);
                                container.addEventListener("mouseout", hide, true);
                            }));
*/
                    });
                }

                function updateKeys() {
                    var keys = favorites.keys();

                    if (keys.length) {
                        placeholder.setAttribute("hidden", "");
                        header.removeAttribute("hidden");
                    } else {
                        placeholder.removeAttribute("hidden");
                        header.setAttribute("hidden", "");
                    }

                    return keys;
                }

                var keys = updateKeys();

                keys.forEach(function (key) {
                    array.push(makeRow({ url: key, tabs: favorites.get(key) }));
                });

                function update(url, action) {
                    var info = { url: url, tabs: favorites.get(url) };

                    if (action === "delete") {
                        if (rows[url]) {
                            rows[url].remove();
                            array.remove(rows[url]);
                            delete rows[url];
                        }
                    } else if (rows[url]) {
                        rows[url].update(info);
                    } else if (url) {
                        array.push(makeRow(info));
                    }

                    updateKeys();

                    array.sort(function (a, b) {
                        return a.info.tabs - b.info.tabs || a.info.url.localeCompare(b.info.url);
                    });

                    array.forEach(function (item) {
                        table.appendChild(item);
                    });

                    trigger(table);
                }
                update();

                Options.event.on("change", function (event) {
                    if (event.name === "tabs.favorites.urls") {
                        update(event.value, event.action);
                    }
                });
            });


            var remove;

            function update(element) {
                var boxes = table.querySelectorAll("input[type=checkbox]:checked");

                if (boxes.length) {
                    element.checked = true;
                    remove.disabled = false;

                    if (boxes.length !== table.children.length) {
                        element.style.opacity = "0.5";
                    } else {
                        element.style.opacity = "";
                    }
                } else {
                    element.checked = false;
                    remove.disabled = true;
                    element.style.opacity = "";
                }
            }

            container["DOM.Element"].appendChild(checkboxbutton({
                container: table,
                create: function (element) {
                    table.addEventListener("Options-update", function () {
                        update(element);
                    }, true);
                },
                update: update
            }));


            remove = container.button({
                text: "Remove selected",
                height: "25px", //! 29px
                create: function (element) {
                    element.disabled = true;
                },
                action: function () {
                    var urls = array.filter(function (item) {
                        if (item.checkbox.checked) {
                            return true;
                        }
                    });

                    urls.forEach(function (item) {
                        favorites.set(item.info.url, null);
                    });
                }
            });

            container.space({ height: "10px" });

            container["DOM.Element"].appendChild(UI.create("div", function (element) {
                element.style.display = "-webkit-box";
                element.style.webkitBoxFlex = "1";
                element.style.webkitBoxOrient = "vertical";
                element.style.background = "#fefefe"; //* white #f8f8f8
                element.style.border = "1px solid dimgray";
                element.style.borderRadius = "2px";

                element.setAttribute("hidden", "");

                setTimeout(function () {
                    element.removeAttribute("hidden");
                }, 0);

                element.appendChild(header);
                element.appendChild(placeholder);
                element.appendChild(table);
            }));
        },


        "Keyboard": function (container) {
            container.header("Open popup with:");

            container.indent(function (container) {
                container.input("checkbox", {
                    option: "popup.hotkey.ctrl",
                    text: "Ctrl (⌘)"
                });

                container.input("checkbox", {
                    option: "popup.hotkey.shift",
                    text: "Shift"
                });

                container.input("checkbox", {
                    option: "popup.hotkey.alt",
                    text: "Alt"
                });

                container.space({ height: "3px" });

                container.input("text", {
                    option: "popup.hotkey.letter",
                    maxlength: 1,
                    width: "2em",
                    modify: function () {
                        return this.value.toUpperCase();
                    }
                });
            });
        },


        "Macros": function (container) {
            var macros = Options.get("macros.list");

            container["DOM.Element"].style.display = "-webkit-box";
            container["DOM.Element"].style.webkitBoxOrient = "vertical";
            container["DOM.Element"].style.webkitBoxPack = "center";

            var placeholder = UI.create("div", function (element) {
                element.textContent = "You haven't created any macros yet";
                element.style.textAlign = "center";
                element.style.paddingTop = "11px";
            });

            var table = UI.create("table", function (table) {
                table.style.width = "100%";
                table.style.paddingTop = "5px";
                table.style.whiteSpace = "nowrap";

                function update() {
                    if (macros.length) {
                        placeholder.setAttribute("hidden", "");
                    } else {
                        placeholder.removeAttribute("hidden");
                    }
                }

                function sequential(array) {
                    var old;
                    return array.every(function (x) {
                        if (typeof old === "undefined") {
                            old = x;
                        } else {
                            old++;
                        }
                        return x === old;
                    });
                }

                table.updateRows = function (indexes) {
                    var list = Array.slice(table.children);

                    /*var seq = sequential(indexes);
                    if (seq && indexes[0] === 0) {
                        up.disabled = true;
                    } else if (seq && indexes[indexes.length - 1] === macros.length) {
                        down.disabled = true;
                    } else {
                        up.disabled = false;
                        down.disabled = false;
                    }*/

                    list.sort(function (a, b) {
                        return macros.indexOf(a.info) - macros.indexOf(b.info);
                    });

                    list.forEach(function (item) {
                        table.appendChild(item);
                    });
                };

                table.removeRow = function (item) {
                    table.removeChild(item);
                    update();
                };

                var isnew;

                table.makeRow = function (info) {
                    if (!info) {
                        info = { search: "" };
                        macros.unshift(info);

                        Options.event.trigger("change", {
                            name: "macros.list"
                        });
                    }

                    update();

                    var row = UI.create("tr", function (container) {
                        container.info = info;

                        var text = UI.create("div", function (element) {
                            element.style.width = "1em";
                            element.style.paddingLeft = "12px";
                        });

                        var windowName = UI.create("input", function (element) {
                            //! element.style.paddingLeft = "4px";
                            element.style.width = "100px";
                            element.value = info.window || "";
                            element.setAttribute("placeholder", "new window");

                            element.addEventListener("keyup", function (element) {
                                info.window = this.value;

                                Options.event.trigger("change", {
                                    name: "macros.list"
                                });
                            }, true);
/*
                            element.addEventListener("change", function () {

                            }, true);*/
                        });

                        container.appendChild(UI.create("td", function (element) {
                            element.appendChild(UI.create("input", function (element) {
                                element.type = "checkbox";

                                if (isnew) {
                                    element.checked = true;
                                    trigger(table);
                                }

                                element.addEventListener("change", function () {
                                    trigger(table);
                                }, true);
                            }));
                        }));

                        container.appendChild(UI.create("select", function (element) {
                            element.style.display = "table-cell";
                            element.style.paddingTop = element.style.paddingBottom = "0px";
                            element.style.marginLeft = "2px";
                            element.style.verticalAlign = "-3px";

                            ["ignore", "require", "move", "close"/**, "noop"*/].forEach(function (key) {
                                element.appendChild(UI.create("option", function (element) {
                                    element.textContent = key;

                                    if (key === info.action) {
                                        element.selected = true;
                                    }
                                }));
                            });

                            function update() {
                                info.action = element.value;

                                if (element.value === "require") {
                                    text.textContent = "in";
                                } else if (element.value === "move") {
                                    text.textContent = "to";
                                } else {
                                    text.textContent = "";
                                }

                                if (element.value === "close" || element.value === "ignore") {
                                    windowName.setAttribute("hidden", "");
                                } else {
                                    windowName.removeAttribute("hidden");
                                }

                                Options.event.trigger("change", {
                                    name: "macros.list"
                                });
                            }
                            update();

                            element.addEventListener("change", update, true);
                        }));

                        container.appendChild(UI.create("td", function (element) {
                            element.style.width = "100%";

                            element.appendChild(UI.create("input", function (element) {
                                element.style.width = "100%";
                                //! element.style.paddingLeft = "4px";

                                element.value = info.search;
                                element.setAttribute("placeholder", "search query");

                                element.addEventListener("keyup", function (element) {
                                    info.search = this.value;

                                    Options.event.trigger("change", {
                                        name: "macros.list"
                                    });
                                }, true);
/*
                                element.addEventListener("change", function () {

                                }, true);*/
                            }));
                        }));

                        container.appendChild(UI.create("td", function (element) {
                            element.appendChild(text);
                        }));

                        container.appendChild(UI.create("td", function (element) {
                            element.appendChild(windowName);
                        }));
                    });

                    if (isnew) {
                        table.insertBefore(row, table.firstChild);
                        row.scrollIntoView(false);
                    } else {
                        table.appendChild(row);
                    }

                    trigger(table);
                };

                macros.forEach(table.makeRow);
                isnew = true;
            });


            var up, down, remove;

            function update(element) {
                var boxes = table.querySelectorAll("input[type=checkbox]:checked");

                /*console.dir(Array.slice(table.children).filter(function (item) {
                    var input = item.querySelector("input[type=checkbox]");
                    return input && input.checked;
                }));*/

                if (boxes.length) {
                    element.checked = true;
                    up.disabled = false;
                    down.disabled = false;
                    remove.disabled = false;

                    if (boxes.length !== table.children.length) {
                        element.style.opacity = "0.5";
                    } else {
                        element.style.opacity = "";
                    }
                } else {
                    element.checked = false;
                    up.disabled = true;
                    down.disabled = true;
                    remove.disabled = true;
                    element.style.opacity = "";
                }

                /*console.log(index, element);
                if (index === 0) {
                    element.style.opacity = 0.5;
                } else {
                    element.style.opacity = 1;
                }*/
            }

            container["DOM.Element"].appendChild(checkboxbutton({
                container: table,
                create: function (element) {
                    table.addEventListener("Options-update", function () {
                        update(element);
                    }, true);
                },
                update: update
            }));

            container.button({
                text: "New macro",
                height: "25px", //! 29px
                action: function () {
                    var boxes = Array.slice(table.children);

                    boxes.forEach(function (item) {
                        var input = item.querySelector("input[type=checkbox]");
                        //console.log(input.checked);
                        input.checked = false;
                    });

                    table.makeRow();
                }
            });

            var wrapper = UI.create("div", function (element) {
                element.style.webkitBoxFlex = "1";
                element.style.padding = "4px 9px 9px 4px";
                element.style.overflowX = "hidden";
                element.style.overflowY = "auto";
                element.style.background = "#fefefe"; //* white #f8f8f8
                element.style.border = "1px solid dimgray";
                element.style.borderRadius = "2px";

                element.setAttribute("hidden", "");

                setTimeout(function () {
                    element.removeAttribute("hidden");
                }, 0);

                element.appendChild(placeholder);
                element.appendChild(table);
            });

            up = container.button({
                text: "", //* "▲",
                height: "25px",
                create: function (element) {
                    element.title = "Move up";
                    element.disabled = true;
                    element.style.padding = "0px 9px";
                    element.style.paddingTop = "1px";
                    element.style.paddingBottom = "";

                    element.style.borderTopRightRadius = "0px";
                    element.style.borderBottomRightRadius = "0px";

                    element.addEventListener("dragstart", function (event) {
                        event.preventDefault();
                    }, true);

                    element.appendChild(UI.create("img", function (element) {
                        element.src = "/images/button-up.png";
                    }));
                },
                onhold: function (element) {
                    // TODO: simplify this?
                    var boxes = Array.slice(table.children).filter(function (item) {
                        var input = item.querySelector("input[type=checkbox]");
                        return input && input.checked;
                    });

                    table.updateRows(boxes.map(function (item, i) {
                        var index = macros.indexOf(item.info);
                        if (index !== -1) {
                            macros.splice(index, 1);

                            if (index <= i) {
                                index += 1;
                            }

                            macros.splice(index - 1, 0, item.info);

                            Options.event.trigger("change", {
                                name: "macros.list"
                            });

                            /*element.disabled = (index <= 1);
                            console.log(index, element.disabled);*/
                        }
                        return index - 1;
                    }));

                    UI.scrollTo(boxes[0], wrapper);
                }
            });

            down = container.button({
                text: "", //* "▼",
                height: "25px",
                create: function (element) {
                    element.title = "Move down";
                    element.disabled = true;
                    element.style.padding = "0px 9px";
                    element.style.paddingTop = "3px";
                    element.style.paddingBottom = "";

                    element.style.marginLeft = "-3px";
                    element.style.borderTopLeftRadius = "0px";
                    element.style.borderBottomLeftRadius = "0px";

                    element.addEventListener("dragstart", function (event) {
                        event.preventDefault();
                    }, true);

                    element.appendChild(UI.create("img", function (element) {
                        element.src = "/images/button-down.png";
                    }));
                },
                onhold: function () {
                    var boxes = Array.slice(table.children).filter(function (item) {
                        var input = item.querySelector("input[type=checkbox]");
                        return input && input.checked;
                    });

                    table.updateRows(boxes.map(function (item, i) {
                        var index = macros.indexOf(item.info);
                        if (index !== -1) {
                            macros.splice(index, 1);
                            macros.splice(index + boxes.length, 0, item.info);

                            Options.event.trigger("change", {
                                name: "macros.list"
                            });
                        }
                        return index + i + 2;
                    }));

                    UI.scrollTo(boxes[boxes.length - 1], wrapper);
                }
            });

            remove = container.button({
                text: "Remove selected",
                height: "25px", //! 29px
                create: function (element) {
                    element.disabled = true;
                },
                action: function () {
                    var boxes = Array.slice(table.children).filter(function (item) {
                        var input = item.querySelector("input[type=checkbox]");
                        return input && input.checked;
                    });

                    boxes.forEach(function (item) {
                        var index = macros.indexOf(item.info);
                        if (index !== -1) {
                            macros.splice(index, 1);

                            Options.event.trigger("change", {
                                name: "macros.list"
                            });
                        }

                        table.removeRow(item);
                    });

                    trigger(table);
                }
            });

            container.space({ height: "10px" });

            container["DOM.Element"].appendChild(wrapper);
        },


        "Popup": function (container) {
            var height = 355;

            container.group(function (container) {
                container.input("dropdown-list", {
                    option: "popup.switch.action",
                    list: [{
                        value: "minimize",
                        text: "Minimize"
                    }, {
                        value: "close",
                        text: "Close"
                    }, {
                        value: "show",
                        text: "Show"
                    }]
                });

                container.input("dropdown-list", {
                    option: "popup.close.when",
                    text: "Tab Organizer",
                    list: [{
                        value: "switch-tab",
                        text: "when switching tabs"
                    }, {
                        value: "switch-window",
                        text: "when switching windows"
                    }]
                });
            });

//                        container.space({ height: "5px" });
            container.separator();
            container.space({ height: "5px" });

            container.input("dropdown-list", {
                option: "popup.type",
                text: "Display in a...",
                list: [{
                    value: "popup",
                    text: "Popup"
                }, {
                    value: "bubble",
                    text: "Bubble"
                }, {
                    value: "tab",
                    text: "Tab"
                }]
            });

//                        container.separator();
            container.space({ height: "5px" });

            container["DOM.Element"].appendChild(UI.create("table", function (element) {
                element.style.backgroundColor = "slategray";
                element.style.borderSpacing = "0px";
                element.style.border = "2px solid black";
                element.style.width = height * (screen.width / screen.height) + "px";

                element.appendChild(UI.create("td", function (element) {
                    element.style.height = height + "px";
                    element.style.padding = "0px !important";

                    element.appendChild(UI.create("div", function (element) {
                        element.style.position = "relative";
                        element.style.width = "100%";
                        element.style.height = "100%";

                        element.appendChild(UI.create("div", function (element) {
                            element.style.position = "absolute";
                            element.style.width = "1px";
                            element.style.height = "100%";
                            element.style.backgroundColor = "red";

                            element.style.left = Options.get("popup.offsetX") + 50 + "%";

                            Options.event.on("change", function (event) {
                                if (event.name === "popup.offsetX") {
                                    element.style.left = event.value + 50 + "%";
                                }
                            });
                        }));

                        element.appendChild(UI.create("div", function (element) {
                            element.style.position = "absolute";
                            element.style.width = "100%";
                            element.style.height = "1px";
                            element.style.backgroundColor = "red";

                            element.style.top = Options.get("popup.offsetY") + 50 + "%";

                            Options.event.on("change", function (event) {
                                if (event.name === "popup.offsetY") {
                                    element.style.top = event.value + 50 + "%";
                                }
                            });
                        }));

                        element.appendChild(UI.create("table", function (element) {
                            element.style.position = "absolute";
                            element.style.margin = "0px";
                            element.style.border = "1px solid darkgreen";
                            element.style.fontSize = "16px";
                            element.style.backgroundColor = "honeydew";

                            function update() {
                                var popup = {
                                    offsetX: Options.get("popup.offsetX"),
                                    offsetY: Options.get("popup.offsetY"),
                                    width: Options.get("popup.width"),
                                    height: Options.get("popup.height")
                                };

                                var width = popup.width / screen.width * 100;
                                var height = popup.height / screen.height * 100;

                                element.style.left = popup.offsetX - width / 2 + 50 + "%";
                                element.style.top = popup.offsetY - height / 2 + 50 + "%";
                                element.style.width = width + "%";
                                element.style.height = height + "%";
                            }
                            update();

                            Options.event.on("change", update);

                            element.appendChild(UI.create("td", function (element) {
                                element.style.padding = "0px";
                                element.style.border = "none";
                                element.style.textAlign = "center";
                                element.style.verticalAlign = "middle";

                                element.textContent = Options.get("popup.type").toUpperCase();

                                Options.event.on("change", function (event) {
                                    if (event.name === "popup.type") {
                                        element.textContent = event.value.toUpperCase();
                                    }
                                });
                            }));
                        }));
                    }));
                }));
            }));

            container["DOM.Element"].appendChild(UI.create("table", function (element) {
                element.style.position = "relative";
                element.style.margin = "12px auto 0px";
                element.style.borderSpacing = "30px 0px";

                element.appendChild(UI.create("td", function (element) {
                    element.className = "align-right";

                    element.appendChild(UI.create("div", function (element) {
                        element.appendChild(container.input("number", {
                            option: "popup.offsetX",
                            text: "Left: ",
                            unit: "%",
                            width: "2.5em"
                        }));
                    }));

                    element.appendChild(UI.create("div", function (element) {
                        element.appendChild(container.input("number", {
                            option: "popup.offsetY",
                            text: "Top: ",
                            unit: "%",
                            width: "2.5em"
                        }));
                    }));
                }));

                element.appendChild(UI.create("td", function (element) {
                    element.className = "align-right";

                    element.appendChild(UI.create("div", function (element) {
                        element.appendChild(container.input("number", {
                            option: "popup.width",
                            text: "Width: ",
                            unit: "px",
                            width: "3em",
                            limit: {
                                min: 200
                            }
                        }));
                    }));

                    element.appendChild(UI.create("div", function (element) {
                        element.appendChild(container.input("number", {
                            option: "popup.height",
                            text: "Height: ",
                            unit: "px",
                            width: "3em",
                            limit: {
                                min: 200
                            }
                        }));
                    }));
                }));
            }));
        },


        "Privacy": function (container) {
            container.header("Usage tracking:");

            container.indent(function (container) {
                container.text("By default, we track how frequently you open the popup and options page, and also what settings you have chosen in the options page.");

                container.space({ height: "1em" });

                container.text("This information is anonymous and is used solely to improve Tab Organizer.");

                container.space({ height: "1em" });

                container.text("You can learn more about what we track <a href='http://documentation.tab-organizer.googlecode.com/hg/Tab%20Organizer%20FAQ.html#can-you-explain-usage-tracking'>here</a>.");

                container.space({ height: "1.25em" });

                container.input("checkbox", {
                    text: "Allow for usage tracking",
                    option: "usage-tracking"
                });
            });
        },


        "Search": function (container) {
            container.input("number", {
                text: "Show ",
                option: "search.show-number",
                unit: " items in the list of past queries",
                width: "2em",
                limit: {
                    min: 0
                }
            });
        },


        "Tabs": function (container) {
            container.group(function (container) {
                container.input("dropdown-list", {
                    option: "tabs.close.location",
                    text: "Show the <img src='/images/button-close.png' alt='close' /> button on the ",
                    list: [{
                        value: "right",
                        text: "right"
                    }, {
                        value: "left",
                        text: "left"
                    }]
                });

                container.input("dropdown-list", {
                    option: "tabs.close.display",
                    text: " side ",
                    list: [{
                        value: "hover",
                        text: "while hovering"
                    }, {
                        value: "focused",
                        text: "of the focused tab"
                    }, {
                        value: "every",
                        text: "of every tab"
                    }]
                });
            });

            container.space({ height: "0.5em" });

            container.input("checkbox", {
                option: "tabs.tree-style.enabled",
                text: "Show tabs in a tree, like <a href='https://addons.mozilla.org/en-US/firefox/addon/tree-style-tab/'>Tree Style Tabs</a>"
            });

            container.space({ height: "0.75em" });

            container.header("Click behavior:");

            container.indent(function (container) {
                container.input("radio-list", {
                    option: "tabs.click.type",
                    list: [{
                        value: "focus",
                        text: "1 click to focus"
                    }, {
                        value: "select-focus",
                        text: "1 click to select, 2 clicks to focus"
                    }]
                });
            });
        },


        "Theme": function (container) {
            container.input("dropdown-list", {
                option: "color.theme",
                text: "Window theme: ",
                list: [{
                    group: "Color:",
                    list: [{
                        value: "Blue",
                        text: "Blue"
                    }, {
                        value: "Green",
                        text: "Green"
                    }, {
                        value: "Yellow",
                        text: "Yellow"
                    }, {
                        value: "Orange",
                        text: "Orange"
                    }, {
                        value: "Red",
                        text: "Red"
                    }, {
                        value: "Pink",
                        text: "Pink"
                    }, {
                        value: "Purple",
                        text: "Purple"
                    }]
                }, {
                    group: "Grayscale:",
                    list: [{
                        value: "Black",
                        text: "Black"
                    }, {
                        value: "Grey",
                        text: "Grey"
                    }, {
                        value: "White",
                        text: "White"
                    }]
                }]
            });

            container["DOM.Element"].style.display = "-webkit-box";
            container["DOM.Element"].style.webkitBoxOrient = "vertical";
            container["DOM.Element"].appendChild(UI.create("iframe", function (element) {
                element.style.webkitBoxFlex = "1";
                element.style.display = "block";
                element.style.border = "none";
                element.style.marginTop = "10px";
                element.src = "/themes/window-viewer.html";
            }));
        },


        "Undo": function (container) {
            container.header("Show undo bar after:");

            container.indent(function (container) {
                container.input("checkbox", {
                    option: "undo.new-tab",
                    text: "Creating a new tab"
                });

                container.input("checkbox", {
                    option: "undo.rename-window",
                    text: "Renaming a window"
                });

                container.input("checkbox", {
                    option: "undo.select-tabs",
                    text: "Un/selecting tabs"
                });

                container.input("checkbox", {
                    option: "undo.pin-tabs",
                    text: "Un/pinning tabs"
                });

                container.input("checkbox", {
                    option: "undo.favorite-tabs",
                    text: "Un/favoriting tabs"
                });

                container.input("checkbox", {
                    option: "undo.move-tabs",
                    text: "Moving tabs"
                });

                container.input("checkbox", {
                    option: "undo.close-tabs",
                    text: "Closing tabs",
                    disabled: true
                });
            });

            container.space({ height: "5px" });

            container.input("number", {
                text: "Show undo bar for ",
                option: "undo.timer",
                unit: "seconds",
                width: "2em",
                limit: {
                    min: 0
                }
            });
        },


        "Windows": function (container) {
            container.header("Display windows:");

            container.indent(function (container) {
                container.input("radio-button", {
                    option: "windows.type",
                    value: "horizontal",
                    text: "...horizontally"
                });

                container.input("radio-button", {
                    option: "windows.type",
                    value: "grid",
                    text: "...in a grid"
                });

                container.indent(function (container) {
                    container.input("number", {
                        option: "windows.grid.columns",
                        unit: "column",
                        limit: {
                            min: 1
                        }
                    });

                    container.input("number", {
                        option: "windows.grid.rows",
                        unit: "row",
                        limit: {
                            min: 1
                        }
                    });
                });
            });

            container.space({ height: "1em" });

            container.header("Window buttons:");

            container.indent(function (container) {
                container.input("checkbox", {
                    option: "windows.button.dropdown",
                    text: "Dropdown menu"
                });

                container.input("checkbox", {
                    option: "windows.button.close",
                    text: "Close button"
                });
            });
        }
    };


    /**
     *
     *   Popup: 6159
     *   Theme: 5976
     *   Privacy: 3731
     *   Keyboard: 3482
     *
     *   Experimental: 1561
     *   Tabs: 1538
     *
     *   Counter: 927
     *   Undo: 679
     *
     *   Search: 429
     *   Favorites: 202
     *   Macros: 39
     *
     **********************
     *
     *   Popup: 2329
     *   Theme: 2137
     *   Privacy: 1250
     *   Keyboard: 1139
     *
     *   Tabs: 616
     *   Experimental: 606
     *   Favorites: 387
     *
     *   Counter: 311
     *   Undo: 224
     *
     *   Search: 95
     *   Macros: 80
     *
     */


    [
        "Theme",
        "Popup",
        "Privacy",
        "Keyboard",

        "Tabs",
        "Windows",
        "Counter",
        "Undo",
        "Search",

        "Favorites",
        "Macros",
        "Experimental"

    ].forEach(function (name) {
        container.category(name, function (container) {
            categories[name](container);
        });
    });
});
