goog.provide("parse")

goog.require("util.array")
goog.require("util.log")
goog.require("util.re")

goog.scope(function () {
  var array  = util.array
    , re     = util.re
    , assert = util.log.assert
    , fail   = util.log.fail
    , log    = util.log.log

  function iterator(s) {
    var i = 0
    return {
      peek: function () {
        return s[i]
      },
      read: function () {
        return s[i++]
      },
      has: function () {
        return i < array.len(s)
      }
    }
  }


  parse.tokens = {}


  /**
   * @constructor
   */
  parse.Prefix = function (x, left) {
    this.op   = x
    this.left = left
  }
  parse.Prefix.prototype["toString"] = function () {
    return "" + this.op + this.left
  }

  /**
   * @constructor
   */
  parse.Infix = function (x, left, right) {
    this.op    = x
    this.left  = left
    this.right = right
  }
  parse.Infix.prototype["toString"] = function () {
    // TODO gross, should instead wrap in parens based on precedence
    if (this.op === " ") {
      return "(" + this.left + this.op + this.right + ")"
    } else {
      return "" + this.left + this.op + this.right
    }
  }

  /**
   * @constructor
   */
  parse.String = function (x) {
    this.value = x
  }
  parse.String.prototype["toString"] = function () {
    return "" + this.value
  }
  parse.String.prototype.prefix = function () {
    return this
  }

  /**
   * @constructor
   */
  parse.RegExp = function (x, flags) {
    this.value = x
    this.flags = flags
  }
  parse.RegExp.prototype["toString"] = function () {
                  // TODO
    return "r/" + this.value + "/" + this.flags
  }
  parse.RegExp.prototype.prefix = parse.String.prototype.prefix


  parse.rule = function (s, o) {
    o.name = s
    parse.tokens[s] = o
  }

  parse.is = function (x, s) {
           // TODO code duplication
    return (x instanceof parse.Prefix ||
            x instanceof parse.Infix) &&
           x.op === s
  }


  function tokenizeString(a) {
    var c, r = []
    while (true) {
      if (!a.has()) {
        throw new SyntaxError("missing ending \"")
      }
      c = a.read()
      if (c === "\"") {
        break
      } else if (c === "\\") {
        c = a.peek()
        if (c === "\"" || c === "\\") {
          array.push(r, a.read())
        } else {
          throw new SyntaxError("expected \\\" or \\\\ but got \\" + c)
        }
      } else {
        array.push(r, c)
      }
    }
    r = array.join(r, "")
    return new parse.RegExp("\\b" + re.escape(r) + "\\b", "i")
  }

  function tokenizeRegexp(a) {
    var flags = []
      , r     = []
      , c
    while (true) {
      if (!a.has()) {
        throw new SyntaxError("missing ending /")
      }
      c = a.read()
      if (c === "/") {
        if (a.peek() === "i") {
          array.push(flags, a.read())
        }
        break
      } else if (c === "\\") {
        if (a.peek() === "/") {
          array.push(r, a.read())
        } else {
          array.push(r, c)
          array.push(r, a.read())
        }
      } else {
        array.push(r, c)
      }
    }
    r     = array.join(r, "")
    flags = array.join(flags, "")
    return new parse.RegExp(r, flags)
  }

  function tokenize(s) {
    var c, a, r = []
    s = iterator(s)
    while (s.has()) {
      c = s.read()
      if (c === " ") {
        while (s.peek() === " ") {
          s.read()
        }
        array.push(r, parse.tokens[" "])
      } else if (c === "\"") {
        array.push(r, tokenizeString(s))
      } else if (parse.tokens[c]) {
        array.push(r, parse.tokens[c])
      } else {
        if (c === "r" && s.peek() === "/") {
          s.read()
          array.push(r, tokenizeRegexp(s))
        } else {
          a = [c]
          while (s.has() && !parse.tokens[s.peek()]) {
            array.push(a, s.read())
          }
          a = array.join(a, "")
          if (a === "OR") {
            array.push(r, parse.tokens["|"])
          } else {
            array.push(r, new parse.String(a))
          }
        }
      }
    }
    // TODO hacky
    a = []
    for (var i = 0, iLen = array.len(r); i < iLen; ++i) {
      var x = r[i]
        , y = r[i + 1]
      if (x === parse.tokens["|"] && y === parse.tokens[" "]) {
        array.push(a, x)
        ++i
      } else if (!(x === parse.tokens[" "] && y === parse.tokens["|"])) {
        array.push(a, x)
      }
    }
    return iterator(a)
  }

  parse.prefix = function (x, a) {
    return new parse.Prefix(x.name, parse1(a, x.priority))
  }

  parse.prefixRight = function (x, a) {
    return new parse.Prefix(x.name, parse1(a, x.priority - 1))
  }

  parse.infix = function (x, a, left) {
    return new parse.Infix(x.name, left, parse1(a, x.priority))
  }

  parse.infixRight = function (x, a, left) {
    return new parse.Infix(x.name, left, parse1(a, x.priority - 1))
  }

  parse.braces = function (left, right) {
    parse.rule(left, {
      priority: 0,
      prefix: function (x, a) {
        var y = parse1(a, x.priority)
        if (!a.has() || a.peek() !== parse.tokens[right]) {
          //throw new SyntaxError("expected ending " + right + " but got " + a.peek())
          throw new SyntaxError("missing ending " + right)
        }
        return y
      }
    })

    parse.rule(right, {
      priority: 0
    })
  }

  var compileRegExp = function (f) {
    return function (tab) {
      return re.test(tab.url, f) || re.test(tab.title, f)
    }
  }

  parse.compile1 = function (x) {
    var old = compileRegExp
    compileRegExp = function (f) {
      return function (x) {
        return re.test(x, f)
      }
    }
    try {
      return parse.compile(x)
    } finally {
      compileRegExp = old
    }
  }

  parse.compile = function (x) {
    if (x instanceof parse.String) {
      return parse.compile(new parse.RegExp(re.escape(x.value), "i"))

    } else if (x instanceof parse.RegExp) {
      return compileRegExp(re.make(x.value, x.flags))

    } else if (x instanceof parse.Prefix ||
               x instanceof parse.Infix) {
      assert(x.op in parse.tokens)
      return parse.tokens[x.op].compile(x)

    } else {
      fail()
    }
  }

  function parse1(a, i) {
    if (a.has()) {
      var t, l = a.read()

      if (l.prefix == null) {
        throw new SyntaxError(l.name + " is not prefix")
      }
      l = l.prefix(l, a)

      while (a.has() && i < a.peek().priority) {
        t = a.read()
        if (t.infix == null) {
          throw new SyntaxError(t.name + " is not infix")
        }
        l = t.infix(t, a, l)
      }
      return l
    } else {
      return new parse.String("")
    }
  }

  parse.parse = function (s) {
    return parse.compile(parse1(tokenize(s), 0))
  }
})
