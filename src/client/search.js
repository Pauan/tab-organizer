// TODO many bugs with the search engine
goog.provide("search")

goog.require("util.cell")
goog.require("util.array")
goog.require("util.object")
goog.require("util.log")
goog.require("util.re")
goog.require("tabs")
goog.require("cache")

goog.scope(function () {
  var cell   = util.cell
    , array  = util.array
    , object = util.object
    , log    = util.log.log
    , assert = util.log.assert
    , re     = util.re

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

  function same(f) {
    return function () {
      var o = {}
      // TODO
      object.each(tabs.getAll(), function (x) {
        var title = f(x)
        if (o[title] == null) {
          o[title] = 0
        }
        ++o[title]
      })
      return function (x) {
        return o[f(x.info)] >= 2
      }
    }
  }

  function tester(name, o) {
    var keys = sortedKeys(o)
    return function (test) {
      // TODO util.array
      for (var i = 0, iLen = array.len(keys); i < iLen; ++i) {
        if (re.test(keys[i], test)) {
          return o[keys[i]]()
        }
      }
      throw new SyntaxError(name + ": expected any of [" + array.join(keys, ", ") + "]")
    }
  }

  var specials = {
    "is": tester("is", {
      "any": function () {
        return function () {
          return true
        }
      },
      "bookmarked": function () {
        // TODO have it make the tabs hidden, THEN get all the bookmarks, THEN do the search
        //var o = LUSH.bookmark.getAll()
        return function (x) {
          return x.info.url in o
        }
      },

      "broken": function () {
        var r = [/^404 Not Found$/,
                 /^Oops! (?:Google Chrome could not |This link appears to be broken)/,
                 / is not available$/,
                 / failed to load$/]
        return function (x) {
          return array.some(r, function (r) {
            return re.test(x.info.title, r)
          })
        }
      },

      "child": null, // TODO

      "duplicated": function () {
        return function (x) {
          // TODO
          return x.info.inChrome > 1
        }
      },

      "image": function () {
        var url   = /\.\w+(?=[#?]|$)/
          , title = /\(\d+×\d+\)$/
        return function (x) {
          // TODO util.regexp
          return re.test(x.info.url, url) && re.test(x.info.title, title)
        }
      },

      "pinned": function () {
        return function (x) {
          return x.info.pinned
        }
      },

      // TODO
      /*"selected": function (x) {
        return $.hasClass(x, "selected")
      },*/

      "unloaded": function () {
        return function (x) {
          // TODO
          return x.info.inChrome === 0
        }
      }
    }),
    "same": tester("same", {
      // TODO
      "domain": same(function (x) {
        return x.location.domain
      }),

      "file": same(function (x) {
        return x.location.domain + x.location.path + x.location.file
      }),

      "path": same(function (x) {
        return x.location.domain + x.location.path
      }),

      "title": same(function (x) {
        return x.title
      }),

      "url": same(function (x) {
        return x.url
      })
    }),
    /*"has": function (self, test) {
      test = test()
      if (test("macro")) {
        return function (x) {

        }
      } else {
        throw new SyntaxError()
      }
    },*/
    "inurl": function (test) {
      test = test(function (x) {
        var r = re.make(x.regexp, x.flags)
        return function (x) {
          // TODO util.regexp
          return r["test"](x)
        }
      })
      return function (x) {
        return test(x.info.url)
      }
    },
    "intitle": function (test) {
      test = test(function (x) {
        var r = re.make(x.regexp, x.flags)
        return function (x) {
          // TODO util.regexp
          return r["test"](x)
        }
      })
      return function (x) {
        return test(x.info.title)
      }
    },
    "group": function (test) {
      test = test()
      return function (x) {
        var b
        // TODO inefficient
        object.each(x.info.groups, function (_, s) {
          if (test(s)) {
            b = true
          }
        })
        return b
      }
    }
    /*"group-tabs<=": function (test) {
      test = test(function (x) {
        return +x.regexp
      })
      if (typeof test !== "number") {
        console.log(test)
      } else {
        throw new SyntaxError()
      }
    }*/
  }

  function sortedKeys(o) {
    var aKeys = object.keys(o)
    array.sort(aKeys, function (x, y) {
      // TODO
      return x["toLocaleUpperCase"]()["localeCompare"](y["toLocaleUpperCase"]())
    })
    return aKeys
  }

  function negate(left, x) {
    if (x.op === "-") {
      return {
        op: "-",
        right: negate(left, x.right)
      }
    } else {
      assert(x.string != null)
      return {
        op: ":",
        left: left,
        right: x
      }
    }
  }

  function comma(r, left, x) {
    if (x.op === ",") {
      comma(r, left, x.left)
      comma(r, left, x.right)
    } else {
      array.push(r, negate(left, x))
    }
  }

  var tokens = {
    /*",": {
      // TODO
      priority: Infinity,
      infix: function () {
        throw new SyntaxError(", can only be used on the right side of :")
      }
    },*/
    ":": {
      priority: 10,
      infix: function (x, a, left) {
        assert(left.string != null)

        var right = parse(a, x.priority)

        var r = []
        comma(r, left.string, right)

        return array.foldl1(r, function (x, y) {
          return {
            op: "|",
            left: x,
            right: y
          }
        })
      },
      compile: function (x) {
        var left  = x.left
          , right = x.right

        assert(right.string != null)

        if (typeof left !== "string" || specials[left] == null) {
          throw new SyntaxError("expected any of [" + array.join(sortedKeys(specials), ", ") + "] but got " + left)
        }

        return specials[left](re.make("^" + re.escape(right.string)))
      }
    },
    "-": {
      priority: 30,
      prefix: function (x, a) {
        return {
          op: "-",
          right: parse(a, x.priority)
        }
      },
      compile: function (x) {
        var right = compile(x.right)
        return function (tab) {
          return !right(tab)
        }
      }
    },
    " ": {
      priority: 20,
      infix: function (x, a, left) {
        return {
          op: " ",
          left: left,
          right: parse(a, x.priority)
        }
      },
      compile: function (x) {
        var left  = compile(x.left)
          , right = compile(x.right)
        return function (tab) {
          return left(tab) && right(tab)
        }
      }
    },
    "|": {
      priority: 10,
      infix: function (x, a, left) {
        return {
          op: "|",
          left: left,
          right: parse(a, x.priority)
        }
      },
      compile: function (x) {
        var left  = compile(x.left)
          , right = compile(x.right)
        return function (tab) {
          return left(tab) || right(tab)
        }
      }
    },
    ",": {
      priority: 20,
      infix: function (x, a, left) {
        return {
          op: ",",
          left: left,
          right: parse(a, x.priority)
        }
      },
      compile: function (x) {
        var left  = compile(x.left)
          , right = compile(x.right)
        return function (tab) {
          return left(tab) || right(tab)
        }
      }
    },
    "(": {
      priority: 0,
      prefix: function (x, a) {
        var right = parse(a, x.priority)
        if (a.peek() !== tokens[")"]) {
          throw new SyntaxError("expected ending )")
        }
        return right
      }
    },
    ")": {
      priority: 0
    }
  }

  function tokenizeString(a) {
    var c, r = []
    while (true) {
      if (!a.has()) {
        throw new SyntaxError("expected ending \"")
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
    return { regexp: "\\b" + re.escape(r) + "\\b", flags: "i" }
  }

  function tokenizeRegexp(a) {
    var flags = []
      , r     = []
      , c
    while (true) {
      if (!a.has()) {
        throw new SyntaxError("expected ending /")
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
    flags = array.join(flags, "")
    r     = array.join(r, "")
    return { regexp: r, flags: flags }
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
        array.push(r, tokens[" "])
      } else if (c === "\"") {
        array.push(r, tokenizeString(s))
      } else if (tokens[c]) {
        array.push(r, tokens[c])
      } else {
        if (c === "r" && s.peek() === "/") {
          s.read()
          array.push(r, tokenizeRegexp(s))
        } else {
          a = [c]
          while (s.has() && !tokens[s.peek()]) {
            array.push(a, s.read())
          }
          a = array.join(a, "")
          if (a === "OR") {
            array.push(r, tokens["|"])
          } else {
            array.push(r, { string: a })
          }
        }
      }
    }
    a = []
    for (var i = 0, iLen = array.len(r); i < iLen; ++i) {
      var x = r[i]
        , y = r[i + 1]
      if (x === tokens["|"] && y === tokens[" "]) {
        array.push(a, x)
        ++i
      } else if (!(x === tokens[" "] && y === tokens["|"])) {
        array.push(a, x)
      }
    }
    return iterator(a)
  }

  function parse(a, i) {
    if (a.has()) {
      var t, l = a.read()

      if (l.string == null && l.regexp == null) {
        // TODO is this correct? used to be `!("prefix" in x)`
        if (l.prefix == null) {
          throw new SyntaxError("unexpected " + l.name)
        }
        l = l.prefix(l, a)
      }

      while (a.has() && i < a.peek().priority) {
        t = a.read()
        l = t.infix(t, a, l)
      }
      return l
    } else {
      return { string: "" }
    }
  }

  function compile(x) {
    if (x.string != null) {
      x = { regexp: re.escape(x.string), flags: "i" }
    }

    if (x.regexp != null) {
      var y = re.make(x.regexp, x.flags)
      return function (tab) {
        return re.test(tab.info.url, y) || re.test(tab.info.title, y)
      }
    } else {
      assert(x.op in tokens)
      return tokens[x.op].compile(x)
    }
  }

  search.on = null

  search.loaded = cell.dedupe(false)

  cell.when(cell.and(cache.loaded, tabs.loaded), function () {
                                                     // TODO inefficient ?
    search.on = cell.bind([cache.get("search.last"), tabs.on], function (s) {
      try {
        return { value: compile(parse(tokenize(s), 0)) }
      } catch (e) {
        return { error: e["message"] }
      }
    })

    search.loaded.set(true)
  })
})
