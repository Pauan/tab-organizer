/*global action, parser, state */

(function () {
    "use strict";

    var cache = {}, ignore, tabs;

    function wrap(result) {
        return result || result === null; //* null means to ignore the result
    }

    parser.prefix({ priority: 50, token: "-",
        output: function (right) {
            return function (item) {
                if (wrap(right(item))) {
                    return "";
                }
                return "NOT";
            };
        }
    });


    parser.infix({ priority: 50, token: "-",
        output: function (left, right) {
            var seen, seenL, seenR;

            var focused = left({ literal: "focused" }) ||
                          right({ literal: "focused" });

            return function (item) {
                if (!cache.range) {
                    seen = 0;

                    seenL = seenR = null;

                    cache.range = state.sorted.filter(function (item) {
                        if (seen === 2) {
                            return false;
                        }

                        var name = item.window.title;

                        if (focused && item.hasAttribute("data-focused")) {
                            seen += 1;
                        } else if (!seenL && left(name)) {
                            seenL = true;
                            seen += 1;
                        } else if (!seenR && right(name)) {
                            seenR = true;
                            seen += 1;
                        }

                        return seen > 0;
                    });
                }

                if (seen === 2) {
                    for (var i = 0; i < cache.range.length; i += 1) {
                        var icon = cache.range[i];
                        if (icon.window.title === item) {
                            return true;
                        }
                    }
                }
            };
        }
    });


    parser.prefix({ priority: 30, token: ",",
        output: function (right) {
            return right;
        }
    });


    parser.infix({ priority: 30, token: ",",// match: /(,) */,
        output: function (left, right) {
            return function (item) {
                var res = left(item);
                if (res === "" || (res && res !== "NOT")) {
                    return res;
                } else {
                    return right(item);
                }
            };
        }
    });


    function dictionary(queries) {
        var keys = Object.keys(queries);

        return function (right) {
            var actions = [];

            var cancel = true;

            keys.forEach(function (key) {
                if (!ignore[key]) {
                    cancel = false;

                    var result = right(key);
                    if (result && result !== "NOT") {
                        actions.push(queries[key]);
                    } else if (result === "") {
                        actions.push(function (item) {
                            return !queries[key](item);
                        });
                    }
                }
            });

            if (cancel) {
                return function () {
                    return null;
                };
            }

            return function (item) {
                for (var i = 0; i < actions.length; i += 1) {
                    if (actions[i](item)) {
                        return true;
                    }
                }
            };
        };
    }

    parser.prefix({ priority: 20, token: "has:",
        output: dictionary({
            "macro": (function () {
                var stop;

                return function (item) {
                    ignore.macro = true;

                    stop = false;

                    if (!cache.macros) {
                        cache.macros = state.macros.filter(function (item) {
                            return item.search;
                        });

                        cache.macros = cache.macros.map(function (item) {
                            var output = parser.output(item.search);

                            if (item.action === "ignore") {
                                return function (item) {
                                    if (output(item)) {
                                        stop = true;
                                    }
                                };
                            } else {
                                return output;
                            }
                        });
                    }

                    for (var i = 0; i < cache.macros.length; i += 1) {
                        if (stop) {
                            return false;
                        } else if (cache.macros[i](item)) {
                            return true;
                        }
                    }
                };
            }())
        })
    });


    parser.prefix({ priority: 20, token: "intitle:",
        output: function (right) {
            return function (item) {
                return right(item.tab.title);
            };
        }
    });


    parser.prefix({ priority: 20, token: "inurl:",
        output: function (right) {
            return function (item) {
                return right(item.tab.url);
            };
        }
    });


    parser.prefix({ priority: 20, token: "is:",
        output: dictionary({
            "any": function (item) {
                return true;
            },

            "bookmarked": function (item) {
                return state.bookmarksByURL[item.tab.url] > 0;
            },

            "broken": (function () {
                var filter, text = [
//                    '"404" | ',
                    'intitle:r/^404 Not Found$/,',
                            'r/^Oops! (?:Google Chrome could not |',
                                        'This link appears to be broken)/,', //! broken$)
                            'r/ is not available$/,',
                            'r/ failed to load$/'
                ].join("");

                return function (item) {
//                    ignore.broken = true;
//
                    if (!filter) {
                        // TODO: can't this be moved up a little...?
                        filter = parser.output(text);
                    }

                    return filter(item);
                };
            }()),

            "child": function (item) {
                return item.style.marginLeft;
            },

            "favorited": function (item) {
                return item.hasAttribute("data-favorited");
            },

            "image": (function () {
                //! var url = /\.(bmp|gif|jpe?g|mng|a?png|raw|tga|tiff?)(?=\?|$)/i;
                var title = /\(\d+×\d+\)$/;
                var url = /\.\w+(?=[#?]|$)/;

                return function (item) {
                    return url.test(item.tab.url) && title.test(item.tab.title);
                };
            }()),

            "pinned": function (item) {
                return item.tab && item.tab.pinned;
            },

            "selected": function (item) {
                return item.hasAttribute("data-selected");
            }
        })
    });


    parser.prefix({ priority: 20, token: "last:",
        output: dictionary({
            "moved": function (item) {
                if (state.last.moved) {
                    return state.last.moved.indexOf(item) !== -1;
                }
            }
        })
    });


    parser.prefix({ priority: 20, token: "will:",
        output: dictionary({
            "move": function (item) {
                if (!cache["will:move"]) {
                    var moved = [];
//
//                    ignore.move = true;

                    var info = state.filterWithMacros(state.macros);

                    info.moved.forEach(function (item) {
                        moved = moved.concat(item.tabs);
//
//                        console.log(item.title, item.tabs);
                    });

                    moved = moved.concat(info.makeNew);
//
//                    console.log(info.makeNew);

                    cache["will:move"] = moved;
                }
//
//                console.log(cache["will:move"].length);

                return cache["will:move"].indexOf(item) !== -1;
            }
        })
    });


    parser.prefix({ priority: 20, token: "same:",
        output: dictionary({
            "domain": function (item) {
                if (!cache.domain) {
                    cache.domain = {};

                    tabs.forEach(function (item) {
                        var url = item.tab.location.domain;
                        cache.domain[url] = cache.domain[url] + 1 || 1;
                    });
                }

                if (item.tab) {
                    return cache.domain[item.tab.location.domain] > 1;
                } else {
                    console.log(item); // TODO
                }
            },

            "file": function (item) {
                var location = item.tab.location;

                if (!cache.file) {
                    cache.file = {};

                    tabs.forEach(function (item) {
                        var location = item.tab.location,
                            url      = location.path + location.file;

                        if (url.length > 1) {
                            url = location.domain + url;
                            //console.log(url);
                            cache.file[url] = cache.file[url] + 1 || 1;
                        }
                    });
                }

                var url = location.domain +
                          location.path +
                          location.file;

                return cache.file[url] > 1;
            },

            "path": function (item) {
                var location = item.tab.location;

                if (!cache.path) {
                    cache.path = {};

                    tabs.forEach(function (item) {
                        var location = item.tab.location,
                            url      = location.path;

                        //console.log(location, item.tab.url);

                        if (url && url.length > 1) {
                            url = location.domain + url;
                            cache.path[url] = cache.path[url] + 1 || 1;
                        }
                    });
                }

                var url = location.domain +
                          location.path;

                return cache.path[url] > 1;
            },

            "title": function (item) {
                if (!cache.titles) {
                    cache.titles = {};

                    tabs.forEach(function (item) {
                        if (item.tab.title) {
                            cache.titles[item.tab.title] = cache.titles[item.tab.title] + 1 || 1;
                        }
                    });
                }

                return cache.titles[item.tab.title] > 1;
            },

            "url": (function () {
                var regexp = /^([^#]+?)\/?(#.*)?$/;

                return function (item) {
                    if (!cache.urls) {
                        cache.urls = {};

                        tabs.forEach(function (item) {
                            var url = regexp.exec(item.tab.url);
                            if (url) {
                                url = url[1];
                                cache.urls[url] = cache.urls[url] + 1 || 1;
                            }
                        });
                    }

                    var url = regexp.exec(item.tab.url);
                    if (url) {
                        return cache.urls[url[1]] > 1;
                    }
                };
            }())
        })
    });


    parser.prefix({ priority: 20, token: "seen:",
        output: dictionary({
            "url": function (item) {
                return state.visitedByURL.has(item.tab.url);
            }
        })
    });


    parser.prefix({ priority: 20, token: "window:",
        output: function (right) {
            var focused = right({ literal: "focused" }),
                unnamed = right({ literal: "unnamed" });

            return function (item) {
                var win = item.parentNode.container;

                if (unnamed) {
                    return state.titles.indexOf(win.window.title) === -1;
                }

                if (focused === "" || typeof focused === "boolean") {
                    if (win.hasAttribute("data-focused")) {
                        return focused;
                    }
                }

                return right(win.window.title);
            };
        }
    });


    parser.prefix({ priority: 20, token: "window-tabs<=:",
        output: function (old) {
            var right = old({ regexp: true }).source;

            for (var i = right; i > 1; i -= 1) {
                right = right + "|" + (i - 1);
            }
            
            console.log(right);

            right = boundtester("(?:" + right + ")");
            //right = function () { return false; };
            return function (item) {
                var win = item.parentNode.container,
                    len = win.window.tabs.length;

                /*for (var i = len; i > 0; i -= 1) {
                    if (right(i)) {
                        return true;
                    }
                }*/

                return right(len);
            };
        }
    });


    parser.infix({ priority: 20, token: " ", match: /( ) */,
        output: function (left, right) {
            return function (item) {
                return wrap(left(item)) && wrap(right(item));
            };
        }
    });



    function OR(left, right) {
        return function (item) {
            return left(item) || right(item);
        };
    }
    parser.infix({ priority: 10, token: " | ",  match: / *( \| ) */, output: OR });
    parser.infix({ priority: 10, token: ", ",   match: /(, ) */,     output: OR });
    parser.infix({ priority: 10, token: " OR ", match: / *( OR ) */, output: OR });


    function tester(regexp, value) {
        return function (item) {
            if (item instanceof Object) {
                if (item.literal) {
                    if (item.literal === value) {
                        return true;
                    }
                } else if (item.regexp) {
                    return regexp;
                } else {
                    return regexp.test(item.tab.title) ||
                           regexp.test(item.tab.url);
                }
            } else {
                return regexp.test(item);
            }
        };
    }

    function boundtester(string) {
        return tester(new RegExp("\\b" + string + "\\b", "i"));
    }

    parser.quotes({ token: '"', match: /(")((?:[^"\n\\]|\\[\s\S])*)(")/,
        output: function (right) {
            return boundtester(right.escape());
        }
    });


    parser.quotes({
        open: "r/", close: "/",
        match: /(r\/)((?:[^\/\\]|\\[\s\S])+\/[i]{0,1})/,
        output: function (right) {
            var split = right.split(/\/(?=[i]{0,1}$)/);
            return tester(new RegExp(split[0], split[1]));
        }
    });


    parser.literal.nud = function () {
        var value = this.name.escape();
        return tester(new RegExp(value, "i"), this.name);
    };


    parser.braces({ open: "(", close: ")" });


    function split(array, test) {
        var output = [];
        output.inverse = [];

        for (var i = 0; i < array.length; i += 1) {
            var item = array[i];
            if (test && test(item)) {
                output.push(item);
            } else {
                output.inverse.push(item);
            }
        }
        return output;
    }

    action.parse = function (string) {
        ignore = {};

        var filter = parser.output(string);

        return function (array) {
            tabs = array;
            cache = {};

            return split(tabs, filter);
        };
    };

    action.search = function (array, string) {
        return action.parse(string)(array);
    };
}());
