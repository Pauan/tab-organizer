/**
 *   Copyright © 2010 Paul Chapman <pcxunlimited@gmail.com>
 *
 *   This file is part of Options.
 *
 *   Options is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU Lesser General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   Options is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU Lesser General Public License for more details.
 *
 *   You should have received a copy of the GNU Lesser General Public License
 *   along with Options.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

/*global chrome, Event, localStorage, window */

var KAE = Object(KAE);
KAE.make = Object(KAE.make);

KAE.make.events = function () {
    "use strict";

    var events = {};

    var obj = {
        decouple: function (global) {
            var clone = Object.create(obj);

            var events = [];

            function remove() {
                global.removeEventListener("beforeunload", remove, true);
                global.removeEventListener("unload", remove, true);

                clone.on = function () {};

                events.forEach(function (item) {
                    clone.remove.apply(clone, item);
                });
            }
            global.addEventListener("beforeunload", remove, true);
            global.addEventListener("unload", remove, true);

            clone.on = function (name, action) {
                var args = [ name, action ];

                events.push(args);
                obj.on.apply(obj, args);
            };

            return clone;
        },

        on: function (name, action) {
            if (typeof action !== "function") {
                throw new TypeError("The 2nd argument must be a function.");
            }

            if (!events[name]) {
                events[name] = [];
            }

            if (events[name].indexOf(action) === -1) {
                events[name].push(action);
            }
        },

        remove: function (name, action) {
            if (typeof action !== "function") {
                throw new TypeError("The 2nd argument must be a function.");
            }

            var event = events[name];
            if (event) {
                var index = event.indexOf(action);
                if (index !== -1) {
                    event.splice(index, 1);
                }
            }
        },

        trigger: (function () {
//!                function noop() {}

//!                var state = {};

//!                var properties = {
//!                    defaultPrevented: {
//!                        get: function () {
//!                            return state.defaultPrevented;
//!                        },
//!                        set: noop
//!                    }//,
//!//                    eventPhase: {
//!//                        get: function () {
//!//                            return state.eventPhase;
//!//                        },
//!//                        set: noop
//!//                    }
//!                };

            return function (name) {
                //! DEBUG
                var debug = events[name];
                if (debug && name === "change") {
                    console.log(name, debug.length);
                }

                if (!events[name] || !events[name].length) {
                    return;
                }

                var args = Array.prototype.slice.call(arguments, 1);

//!                    info = Object(info);
//!                    info.type = name;


//!                var info = Object.create(this, {
//!                    "type": {
//!                        configurable: false,
//!                        writable: false,
//!                        value: name
//!                    }
//!                });

//!                    if (typeof info.cancelable !== "boolean") {
//!                        info.cancelable = true;
//!                    }


//!                    info.preventDefault = function () {
//!                        if (this.cancelable) {
//!                            state.defaultPrevented = true;
//!                        }
//!                    };
//!                    info.stopPropagation = function () {
//!                        state.shouldStop = true;
//!                    };


//!                    Object.defineProperties(info, properties);
//!                    Object.freeze(info);

//!                    state.shouldStop = state.defaultPrevented = false;

//!                    var self = this;


                try {
                    events[name].forEach(function (item) {
    //!                        if (!state.shouldStop) {

                        item.apply(null, args);
    //!                        item.call(self, info);
    //!                        }

                    });
                } catch (e) {
                    console.error(e);
                }
            };
        }())
    };
    return obj;
};


var Options = (function () {
    "use strict";

    var config, page, Options;

    function dictionary(config) {
        config = Object(config);
        config.base = Object(config.base);
        config.user = Object(config.user);

        return {
            "options.config": config,

            getAll: function () {
                var object = {};
                Object.keys(config.base).forEach(function (key) {
                    object[key] = config.base[key];
                });
                Object.keys(config.user).forEach(function (key) {
                    object[key] = config.user[key];
                });
                return object;
            },


            snapshot: function () {
                var object = {
                    base: {},
                    user: {}
                };
                Object.keys(config.base).forEach(function (key) {
                    object.base[key] = config.base[key];
                });
                Object.keys(config.user).forEach(function (key) {
                    object.user[key] = config.user[key];
                });
                return object;
            },


            get: function (name) {
                return (name in config.user) ? config.user[name] : config.base[name];
            },


            getDefault: function (name) {
                return config.base[name];
            },


            isDefault: function (name) {
                return !(name in config.user) || config.user[name] === config.base[name];
            }
        };
    }


    try {
        page = chrome.extension.getBackgroundPage();
    } catch (e) {
        //* This is for content scripts only:

        Options = dictionary();

        Options.linkToPage =  function (action) {
            if (typeof action !== "function") {
                throw new TypeError("First argument must be a function.");
            }

            if (config) {
                action(Options);
            } else {
                var port = chrome.extension.connect({ name: "lib.Options" });

                port.onMessage.addListener(function (json) {
                    if (json.config) {
                        config = json.config;
                        Options["options.config"].base = config.base;
                        Options["options.config"].user = config.user;
                        action(Options);
                    } else if (config) {
                        config.user[json.name] = json.value;
                    }
                });
            }
        };
        return Options;
    }

    var exists = (page.Options && typeof page.Options === "object");

    if (exists) {
        Options = Object.create(page.Options);
        Options.event = Options.event.decouple(window);
    } else {
        Options = dictionary();
        Options.event = KAE.make.events();
    }


    //* This is for all scripts, except content scripts:

    Options.getObject = function (name) {
        try {
            if (typeof name === "string") {
                name = JSON.parse(name);
            }
        } catch (e) {
            name = undefined;
        } finally {
            return Object(name);
        }
    };

    Options.getArray = function (name) {
        var array = Options.getObject(name);

        if (!(array instanceof Array)) {
            array = [];
        }
        return array;
    };


    //* This is for non-background page scripts only:

    if (exists) {
        console.warn("Replacing with background Options!");

        Options.cancelConfig = (function () {
            var old = Options.snapshot();

            return function () {
                Object.keys(old.base).forEach(function (key) {
                    Options.set(key, old.base[key]);
                });
                Object.keys(old.user).forEach(function (key) {
                    Options.set(key, old.user[key]);
                });
                Options.saveConfig();
            };
        }());


        Options.createContainer = (function () {
            var category = {
                header: function (text) {
                    var line = document.createElement("div");
                    line.style.marginBottom = "6px";

                    var item = document.createElement("strong");

                    if (typeof text === "function") {
                        text(Object.create(category, {
                            "DOM.Element": { value: item }
                        }));
                    } else {
                        item.textContent = text;
                    }

                    line.appendChild(item);
                    this["DOM.Element"].appendChild(line);
                    return item;
                },


                indent: function (initialize) {
                    var item = document.createElement("div");
                    item.className = "Options-indent";

                    var clone = Object.create(category, {
                        "DOM.Element": { value: item }
                    });

                    if (typeof initialize === "function") {
                        initialize(clone);
                    }

                    this["DOM.Element"].appendChild(item);
                    return item;
                },


                group: function (initialize) {
                    var item = document.createElement("div");
                    item.className = "Options-group";

                    var clone = Object.create(category, {
                        "DOM.Element": { value: item }
                    });

                    if (typeof initialize === "function") {
                        initialize(clone);
                    }

                    this["DOM.Element"].appendChild(item);
                    return item;
                },


                input: (function () {
                    function limiter(info, type) {
                        var limit = info.limit;
                        var saved = info.modify;

                        if (type === "number") {
                            limit = Object(limit);
                        }
                        if (limit instanceof Object) {
                            if (typeof limit.digits === "number") {
                                info.verbatim = true;
                            }

                            info.modify = function (info) {
                                if (typeof saved === "function") {
                                    this.value = saved.call(this, info);
                                }

                                var value = this.value;
                                if (typeof limit.min === "number") {
                                    value = Math.max(limit.min, value);
                                }
                                if (typeof limit.max === "number") {
                                    value = Math.min(limit.max, value);
                                }
                                value += "";

                                if (typeof limit.digits === "number") {
                                    if (value.length > limit.digits) {
                                        value = value.slice(0, limit.digits);
                                    }
                                    while (value.length < limit.digits) {
                                        value = "0" + value;
                                    }
                                }

                                if (type === "number") {
                                    if (isNaN(+value)) {
                                        value = Options.getDefault(info.option);
                                    }
                                }
                                return value;
                            };
                        }
                        return info;
                    }

                    var types = {
                        "radio-button": function (info) {
                            var line = document.createElement("div");

                            var input = document.createElement("input");
                            input.type = "radio";
                            input.name = info.option;
                            input.value = info.value;

                            var label = document.createElement("label");

                            var span = document.createElement("span");
                            span.textContent = info.text;

                            input.disabled = info.disabled;
                            if (input.disabled) {
                                label.style.color = "lightgrey !important";
                            }

                            info.tooltip = label;
                            Options.on(info.on)(input, info);

                            label.appendChild(input);
                            label.appendChild(span);
                            line.appendChild(label);
                            this.appendChild(line);
                        },


                        "radio-list": function (info) {
                            var self = this;

                            if (info.list instanceof Array) {
                                info.list.forEach(function (item) {
                                    var clone = Object.create(info);
                                    clone.value = item.value;
                                    clone.text = item.text;
                                    clone.disabled = item.disabled;
                                    types["radio-button"].call(self, clone);
                                });
                            }
                        },


                        "dropdown-list": (function () {
                            function parseList(parent, array) {
                                if (array instanceof Array) {
                                    array.forEach(function (item) {
                                        item = Object(item);

                                        var option;

                                        if (item.group) {
                                            option = document.createElement("optgroup");
                                            option.label = item.group;
                                            parseList(option, item.list);
                                        } else {
                                            option = document.createElement("option");
                                            option.value = item.value;
                                            option.textContent = item.text;
                                        }

                                        parent.appendChild(option);
                                    });
                                }
                            }
                            return function (info, span) {
                                var select = document.createElement("select");
                                select.disabled = info.disabled;

                                parseList(select, info.list);

                                this.appendChild(select);

                                Options.on(info.on)(select, info);
                            };
                        }()),


                        "checkbox": function (info, span) {
                            var input = document.createElement("input");
                            input.type = "checkbox";

                            var label = document.createElement("label");

                            input.disabled = info.disabled;
                            if (input.disabled) {
                                label.style.color = "lightgrey !important";
                            }

                            label.appendChild(input);
                            label.appendChild(span);
                            this.appendChild(label);

                            info.tooltip = label;
                            info.property = "checked";
                            Options.on(info.on)(input, info);
                        },


                        "text": function (info, span) {
                            var input = document.createElement("input");
                            input.type = "text";
                            input.style.width = info.width;

                            if (typeof info.maxlength === "number") {
                                input.maxLength = info.maxlength;
                            }

                            this.appendChild(input);

                            Options.on(info.on)(input, info);
                        },


                        "number": function (info, span) {
                            var input = document.createElement("input");
                            input.type = "text";
                            input.style.width = info.width;

                            if (typeof info.maxlength === "number") {
                                input.maxLength = info.maxlength;
                            }

                            info = limiter(info, "number");

                            this.appendChild(input);

                            Options.on(info.on)(input, info);
                        },


                        "slider": function (info, span) {
                            var input = document.createElement("input");
                            input.type = "range";
                            input.min = info.min;
                            input.max = info.max;
                            input.step = info.step;

                            span.style.display = "table-cell";
                            span.style.verticalAlign = "middle";
                            span.style.textAlign = "right";
                            span.style.paddingRight = "7px";
                            this.style.display = "table-row";
                            this.appendChild(input);
                        }
                    };

                    return function (type, info) {
                        info = Object(info);
                        info.on = info.on || "change";
                        info.width = info.width || "2em";

                        var line = document.createElement("div");
                        line.style.whiteSpace = "pre";
                        line.style.marginBottom = "4px";

                        var text = document.createElement("span");
                        var unit = document.createElement("span");
                        unit.style.padding = "0 2px";

                        if (type !== "radio-button") {
                            line.appendChild(text);
                        }

                        if (typeof types[type] === "function") {
                            types[type].call(line, info, text);
                        }

                        if (info.text) {
                            text.innerHTML = info.text;
                        }
                        if (info.unit) {
                            unit.innerHTML = info.unit;
                            line.appendChild(unit);
                        }

                        this["DOM.Element"].appendChild(line);
                        return line;
                    };
                }()),


                space: function (info) {
                    info = Object(info);

                    var item = document.createElement("div");
                    item.style.width = info.width;
                    item.style.height = info.height;

                    this["DOM.Element"].appendChild(item);
                    return item;
                },


                button: function (info) {
                    info = Object(info);

                    var item = document.createElement("button");
                    item.className = "Options-button";
                    item.textContent = info.text;
                    item.style.width = info.width;
                    item.style.height = info.height;

                    if (typeof info.create === "function") {
                        info.create(item);
                    }
                    if (typeof info.action === "function") {
                        item.addEventListener("click", info.action, true);
                    }
                    if (typeof info.onhold === "function") {
                        var timer;

                        item.addEventListener("mousedown", function () {
                            clearTimeout(timer);

                            info.onhold(item);

                            timer = setTimeout(function anon() {
                                info.onhold(item);
                                timer = setTimeout(anon, 100);
                            }, 500);
                        }, true);

                        item.addEventListener("mouseup", function () {
                            clearTimeout(timer);
                        }, true);
                    }

                    this["DOM.Element"].appendChild(item);
                    return item;
                },


                text: function (text) {
                    var item = document.createElement("div");
                    item.innerHTML = text;

                    this["DOM.Element"].appendChild(item);
                    return item;
                },


                separator: function () {
                    var item = document.createElement("hr");
                    this["DOM.Element"].appendChild(item);
                    return item;
                }
            };

            var make = {
                container: (function () {
                    var prototype = {
                        separator: function () {
                            var element = document.createElement("hr");
                            element.className = "Options-list-separator";
                            this.categoryList.appendChild(element);
                        },


                        category: function (name, initialize) {
                            var self = this;

                            var clone = Object.create(category, {
                                "DOM.Element": { value: document.createElement("div") }
                            });

                            if (typeof initialize === "function") {
                                initialize(clone);
                            }


                            var content = clone["DOM.Element"];
                            this["DOM.Element"].appendChild(content);

                            this["DOM.Element"].style.display = "block !important";
                            this.minHeight = Math.max(this.minHeight, content.offsetHeight);

                            this["DOM.Element"].style.display = "";
                            this.minWidth = Math.max(this.minWidth, content.offsetWidth);

                            this["DOM.Element"].removeChild(content);


                            this.categories.push(content);

                            this.categories.forEach(function (item) {
                                item.style.width = self.minWidth + "px !important";
                                item.style.height = self.minHeight + "px !important";
                            });

                            if (this.categories.length < 2) {
                                this.categoryList.setAttribute("hidden", "");
                            } else {
                                this.categoryList.removeAttribute("hidden");
                            }


                            var item = document.createElement("li");
                            item.className = "Options-list-item";
                            item.textContent = name;

                            function select() {
                                if (self.selected) {
                                    self.selected.removeAttribute("data-selected");
                                }
                                self.selected = item;

                                var display = self.display;

                                display.innerHTML = "";
                                display.appendChild(content);

                                item.setAttribute("data-selected", "");
                            }
                            item.addEventListener("click", select, true);

                            if (!this.selected) {
                                select();
                            }

                            this.categoryList.appendChild(item);
                        }
                    };

                    return function () {
                        var item = document.createElement("table");
                        item.id = "Options-inner";

                        var clone = Object.create(prototype);

                        clone.minWidth = clone.minHeight = 0;

                        clone.categories = [];

                        var list = document.createElement("ul");
                        list.id = "Options-list";
                        list.tabIndex = 0;

                        clone.categoryList = list;

                        list.addEventListener("mousedown", function (event) {
                            event.preventDefault();
                        }, true);

                        addEventListener("keydown", function (event) {
                            var focused = document.activeElement;
                            if (focused === document.body || focused === list) {
                                if (event.which === 38 || event.which === 40) {
                                    var element = (event.which === 38
                                                    ? clone.selected.previousSibling
                                                    : clone.selected.nextSibling);

                                    if (element) {
                                        event.preventDefault();

                                        var info = document.createEvent("Event");
                                        info.initEvent("click", true, false);
                                        element.dispatchEvent(info);
                                    }
                                }
                            }
                        }, true);

                        clone.display = document.createElement("td");
                        clone.display.id = "Options-content";

                        item.appendChild(list);
                        item.appendChild(clone.display);

                        clone["DOM.Element"] = item;

                        return clone;
                    };
                }())
            };

            return function (initialize) {
                var container = document.createElement("table");
                container.id = "Options-root";

                container.addEventListener("selectstart", function (event) {
                    var tag = event.target.localName;
                    if (tag !== "input" && tag !== "textarea") {
                        event.preventDefault();
                    }
                }, true);

                var contents = document.createElement("td");
                contents.id = "Options-wrapper";

                var outer = document.createElement("div");
                outer.id = "Options-outer";

                var inner = make.container();

                var title = document.createElement("div");
                title.id = "Options-title";
                title.textContent = document.title;

                outer.appendChild(title);
                outer.appendChild(inner["DOM.Element"]);

                contents.appendChild(outer);
                container.appendChild(contents);

                document.body.appendChild(container);

                if (typeof initialize === "function") {
                    initialize(inner);
                }

                var bottom = document.createElement("div");
                bottom.id = "Options-bottom";
                bottom.textContent = "Your changes are automatically saved.";

                var buttons = document.createElement("div");
                buttons.id = "Options-buttons";

                var button = {
                    reset: document.createElement("button"),
                    close: document.createElement("button")
                };

                button.reset.className = "Options-button";
                button.reset.textContent = "Reset to Defaults";
                button.reset.addEventListener("click", Options.resetConfig, true);

                button.close.className = "Options-button";
                button.close.textContent = "Close";
                button.close.addEventListener("click", function () {
                    close();
                }, true);

                buttons.appendChild(button.reset);
                buttons.appendChild(button.close);

                bottom.appendChild(buttons);
                outer.appendChild(bottom);

                return container;
            };
        }());


        Options.sync = function (elem, info) {
            info = Object(info);

            info.property = info.property || "value";

            var tooltip = info.tooltip || elem;
            var current = Options.get(info.option);

            var flags = {
                verbatim: info.verbatim
            };

            function highlight(name) {
                if (Options.isDefault(name)) {
                    elem.removeAttribute("data-options-changed");

                    tooltip.title = "";
                } else {
                    elem.setAttribute("data-options-changed", "");

                    tooltip.title = "Default: " + Options.getDefault(info.option);
                }
            }
            highlight(info.option);


            if (elem.type === "radio") {
                var radio = function (elem, value) {
                    if (elem.value === value) {
                        elem.checked = true;
                    }
                };
                radio(elem, current);

                Options.event.on("change", function (event) {
                    if (event.name === info.option) {
                        radio(elem, event.value);
                        highlight(info.option);
                    }
                });
            } else {
                elem[info.property] = current;

                Options.event.on("change", function (event) {
                    if (event.name === info.option) {
                        if (elem[info.property] !== (event.value + "")) {
                            elem[info.property] = event.value;
                        }
                        highlight(info.option);
                    }
                });
            }

            return function () {
                if (typeof info.modify === "function") {
                    var value = info.modify.call(elem, info);
                    Options.set(info.option, null);
                    Options.set(info.option, value, flags);
                } else {
                    Options.set(info.option, elem[info.property], flags);
                }
            };
        };


        Options.on = (function () {
            var cache = {};

            return function (type) {
                if (typeof cache[type] !== "function") {
                    cache[type] = function (elem, info) {
                        elem.addEventListener(type, Options.sync(elem, info), false);
                    };
                }
                return cache[type];
            };
        }());


        return Options;
    }


    //* This is for the background page only:

    config = Options["options.config"];
    config.base = Options.getObject(localStorage["Options.config.base"]);
    config.user = Options.getObject(localStorage["Options.config.user"]);


    chrome.extension.onConnect.addListener(function anon(port) {
        if (port.name === "lib.Options") {
            port.postMessage({
                config: config
            });

            if (!anon.ports) {
                anon.ports = [];

                Options.event.on("change", function (event) {
                    anon.ports.forEach(function (port) {
                        port.postMessage(event);
                    });
                });
            }

            if (anon.ports.indexOf(port) === -1) {
                anon.ports.push(port);

                port.onDisconnect.addListener(function () {
                    var index = anon.ports.indexOf(port);
                    if (index !== -1) {
                        anon.ports.splice(index, 1);
                    }
                });
            }
        }
    });


    Options.saveConfig = function () {
        localStorage["Options.config.base"] = JSON.stringify(config.base);
        localStorage["Options.config.user"] = JSON.stringify(config.user);
        console.log("saving config");
    };

    var minutes = 5 * 60 * 1000; //! 5 minutes

    setTimeout(function anon() {
        Options.saveConfig();
        setTimeout(anon, minutes);
    }, minutes);


    Options.resetConfig = function () {
        if (confirm("Do you want to reset everything to the default settings?")) {
            Object.keys(config.user).forEach(function (key) {
                Options.set(key, config.base[key]);
            });
            Options.saveConfig();
            Options.event.trigger("reset", {
                cancelable: false
            });
            //! Options.cancelConfig = function () {};
        }
    };


    Options.set = (function () {
        function set(name, value) {
            var action;
            if (value !== config.user[name]) {
                if (value === config.base[name]) {
                    delete config.user[name];
                    action = "delete";
                } else {
                    config.user[name] = value;
                }
                Options.event.trigger("change", {
                    cancelable: false,
                    value: value,
                    name: name,
                    action: action
                });
            }

            return value;
        }
        return function (name, value, info) {
            info = Object(info);

            if (!info.verbatim) {
                if (value === null) {
                    value = config.base[name];
                } else if (typeof value === "string") {
                    var number = +value;
                    if (!isNaN(number)) {
                        return set(name, number);
                    }
                }
            }
            return set(name, value);
        };
    }());


    Options.setObject = function (name) {
        if (typeof config.base[name] !== "object") {
            config.base[name] = {};
        }

        var object = config.base[name];
        if (typeof object.data !== "object") {
            object.data = {};
        }

        object.has = function (key) {
            return key in this.data;
        };

        object.get = function (key) {
            return this.data[key];
        };

        object.keys = function () {
            return Object.keys(this.data);
        };

        object.set = function (key, value) {
            var action;
            if (this.data[key] !== value) {
                if (value === null) {
                    delete this.data[key];
                    action = "delete";
                } else {
                    this.data[key] = value;
                }

                Options.event.trigger("change", {
                    cancelable: false,
                    value: key,
                    name: name,
                    action: action
                });
            }

            return value;
        };

        return object;
    };


    Options.setArray = function (name) {
        if (Object.prototype.toString.call(config.base[name]) !== "[object Array]") {
            config.base[name] = [];
        }
    };


    Options.setDefault = function (name, value) {
        config.base[name] = value;

//!        if (config.user[name] === config.base[name]) {
//!            delete config.user[name];
//!        }
    };


    Options.deleteDefault = function (name) {
        delete config.base[name];
    };


    Options.setDefaults = function (object) {
        Object.keys(object).forEach(function (key) {
            Options.setDefault(key, object[key]);
        });
        Options.saveConfig();
    };


    return Options;
}());


addEventListener("unload", Options.saveConfig, true);
