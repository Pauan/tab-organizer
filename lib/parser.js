/**
 *
 *  Top down operator precedence parser; aka Pratt parser
 *
 *
 *  I learned about the idea from Douglas Crockford (http://javascript.crockford.com/tdop/tdop.html)
 *
 *  Loosely based on the work of Fredrik Lundh (http://effbot.org/zone/simple-top-down-parsing.htm)
 *                                             (http://effbot.org/zone/tdop-index.htm)
 *
 */

var parser = (function () {
    "use strict";

    var state = {
        symbols: {},
        tokens: [],
        next: function () {
            state.tokens.shift();
            return state.tokens[0];
        }
    };

    var base = {
        nud: function () {},
        led: function () {}
    };

    function noop() {}

    /*!function log(token) {
        if (token) {
            return token.name || token.value;
        }
    }*/

    function advance() {
        if (!state.token) {
            console.error("End of stream.");
        }
        state.token = state.next();
        return state.token;
    }

    function expression(num) {
        num = num || 0;

        var left, token;

        token = state.token;
        advance();

//!        console.log(log(token), log(state.token));

        if (token.macro) {
            left = token.macro(state.token);
        } else {
            left = token.nud();
        }

//!        console.log(log(token), log(state.token), left);

        while (state.token && num < state.token.priority) {
            token = state.token;
            advance();

            if (token.macro) {
                left = token.macro(left);
            } else {
                left = token.led(left);
            }

//!            console.log(log(token), log(state.token), left, "INNER");
        }

//!        console.log("");

        return left;
    }


    var parser = {
        expression: expression,

        invalid: function () {
            return noop;
        },

        literal: {
            nud: function () {
                return this.name;
            }
        },


        symbol: function (info) {
            info.priority = info.priority || 0;

            var name = info.token;

            var object = state.symbols[name];

            if (!object) {
                if (!info.match) {
                    info.match = new RegExp("(" + name.replace(/\W/g, "\\$&") + ")");
                }

                object = Object.create(base);
                object.regexp = info.match;
                object.name = name;
                object.priority = info.priority;
                state.symbols[name] = object;
            }

            return object;
        },


        braces: function (info) {
            parser.symbol({ token: info.close });
            parser.symbol({ token: info.open }).nud = function () {
                var result = expression();
                advance();
                return result;
            };
        },


        infix: function (info) {
            var object = parser.symbol(info);

            object.led = function (left) {
                var result = expression(info.priority);

                if (!result) {
                    result = parser.invalid();
                }

                return info.output(left, result);
            };

            return object;
        },


        prefix: function (info) {
            var object = parser.symbol(info);

            object.nud = function () {
                var result = expression(info.priority);

                if (result) {
                    return info.output.call(this, result);
                }

                return parser.literal.nud.call(object);
            };

            return object;
        },


        quotes: function (info) {
            if (!info.token) {
                info.token = info.open;
            }

            var object = parser.symbol(info);

            object.nud = function () {
                if (state.token.name) {
                    var result = info.output(state.token.name);
                    if (!info.close) {
                        expression();
                    }
                    advance();
                    return result;
                }
            };

            return object;
        },


        suffix: function (info) {
            info.priority = 1;

            var object = parser.symbol(info);

            object.led = function (left) {
                return info.output(left);
            };

            return object;
        }
    };


    function literal(value) {
        var object = Object.create(parser.literal);
        object.name = value;
        return object;
    }

    function tokenize(input) {
        var list = Object.keys(state.symbols).map(function (key) {
            return state.symbols[key].regexp.source;
        });

        list = list.sort(function (a, b) {
            return b.length - a.length;
        });

        var pattern = new RegExp(list.join("|"));

//!        console.log(pattern);

        var tokens = input.split(pattern).filter(function (name) {
            return name;
        });

//!        console.log(tokens);

        if (tokens.length) {
            tokens = tokens.map(function (name) {
                if (state.symbols[name]) {
                    return state.symbols[name];
                } else {
                    return literal(name);
                }
            });
        } else {
            tokens = [ literal("") ];
        }

        tokens.push(Object.create(base));

//!        console.log(tokens.slice());

        return tokens;
    }


    parser.output = function (string) {
        state.tokens = tokenize(string);
        state.token = state.tokens[0];
        state.input = string;
        return expression();
    };

    return parser;
}());
