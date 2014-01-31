// TODO many bugs with the search engine
goog.provide("search")

goog.require("util.cell")
goog.require("util.array")
goog.require("util.object")
goog.require("cache")

goog.scope(function () {
  var cell   = util.cell
    , array  = util.array
    , object = util.object

  // [\^$.|?*+()
  function reQuote(s) {
    // TODO util.string or util.regexp
    return s["replace"](/[\[\\\^\$\.\|\?\*\+\(\)]/g, "\\$&")
  }

  function same(f) {
    /*var o = {}
    tab.each(function (x) {
      var title = f(x)
      if (o[title] == null) {
        o[title] = 0
      }
      ++o[title]
    })
    return function (x) {
      return o[f(x.info)] >= 2
    }*/
  }

  function tester(name, o) {
    var keys = sortedKeys(o)
    return function (test) {
      test = test()
      // TODO iter
      for (var i = 0, iLen = array.len(keys); i < iLen; ++i) {
        if (test(keys[i])) {
          return o[keys[i]]
        } else {
          throw new SyntaxError(name + ": expected any of [" + array.join(keys, ", ") + "]")
        }
      }
    }
  }

  var specials = {
    "is": tester("is", {
      "any": function () {
        return true
      },
      "bookmarked": (function () {
        // TODO have it make the tabs hidden, THEN get all the bookmarks, THEN do the search
        //var o = LUSH.bookmark.getAll()
        return function (x) {
          return x.info.url in o
        }
      })(),

      "broken": (function () {
        var r = [/^404 Not Found$/,
                 /^Oops! (?:Google Chrome could not |This link appears to be broken)/,
                 / is not available$/,
                 / failed to load$/]
        return function (x) {
          return array.some(r, function (r) {
            // TODO util.regexp
            return r["test"](x.info.title)
          })
        }
      })(),

      "child": null, // TODO

      "duplicated": function (x) {
        // TODO
        return x.info.inChrome > 1
      },

      "image": (function () {
        var url   = /\.\w+(?=[#?]|$)/
          , title = /\(\d+×\d+\)$/
        return function (x) {
          // TODO util.regexp
          return url["test"](x.info.url) && title["test"](x.info.title)
        }
      })(),

      "pinned": function (x) {
        return x.info.pinned
      },

      // TODO
      /*"selected": function (x) {
        return $.hasClass(x, "selected")
      },*/

      "unloaded": function (x) {
        // TODO
        return x.info.inChrome === 0
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
        var r = new RegExp(x.regexp, x.flags)
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
        var r = new RegExp(x.regexp, x.flags)
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

  var tokens = {
    /*",": {
      priority: 50,
      infix: function (a, left, right) {
        left  = left()
        right = right()
        return function (x) {
          return left(x) || right(x)
        }
      }
    },*/
    ":": {
      name: ":",
      priority: 40,
      infix: function (a, left, right) {
        left = left(function (x) {
          return x.regexp
        })

        log(left)

        if (typeof left !== "string" || !specials[left]) {
          throw new SyntaxError("expected any of [" + array.join(sortedKeys(specials), ", ") + "] but got " + left)
        }

        return specials[left](function (gen) {
          if (gen == null) {
            return right(function (x) {
              var r = new RegExp("^" + x.regexp)
              return function (x) {
                // TODO util.regexp
                return r["test"](x)
              }
            })
          } else {
            return right(gen)
          }
        })
      }
    },
    "-": {
      name: "-",
      priority: 30,
      prefix: function (a, right) {
        right = right()
        return function (x) {
          return !right(x)
        }
      }
    },
    " ": {
      name: " ",
      priority: 20,
      infix: function (a, left, right) {
        left  = left()
        right = right()
        return function (x) {
          return left(x) && right(x)
        }
      }
    },
    "|": {
      name: "|",
      priority: 10,
      infix: function (a, left, right) {
        left  = left()
        right = right()
        return function (x) {
          return left(x) || right(x)
        }
      }
    },
    "(": {
      name: "(",
      priority: 0,
      prefix: function (a, right) {
        var x = right()
        if (a.peek() !== tokens[")"]) {
          throw new SyntaxError("expected ending )")
        }
        return x
      }
    },
    ")": {
      name: ")",
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
             // TODO
    return { name: r, regexp: "\\b" + reQuote(r) + "\\b", flags: "i" }
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
             // TODO
    return { name: r, regexp: r, flags: flags }
  }

  function tokenize(s) {
    var c, a, r = []
    s = new buffer.Buffer(s)
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
            array.push(r, { name: a, regexp: reQuote(a), flags: "i" })
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
    // TODO should probably use something in the iter module instead...
    return new buffer.Reader(a)
  }

  function generate(gen, x) {
    // TODO is this correct? used to be `"regexp" in x`
    if (x.regexp != null) {
      if (gen == null) {
        var r = new RegExp(x.regexp, x.flags)
        return function (x) {
          // TODO util.regexp
          return r["test"](x.info.url) || r["test"](x.info.title)
        }
      } else {
        return gen(x)
      }
    } else {
      return x
    }
  }

  function expression(a, i) {
    if (a.has()) {
      var t, l = a.read()

      // TODO is this correct? used to be `!("regexp" in x)`
      if (l.regexp == null) {
        // TODO is this correct? used to be `!("prefix" in x)`
        if (l.prefix == null) {
          throw new SyntaxError("unexpected " + l.name)
        }
        l = l.prefix(a, function (gen) {
          return generate(gen, expression(a, l.priority))
        })
      }

      while (a.has() && i < a.peek().priority) {
        t = a.read()
        l = t.infix(a, function (gen) {
          return generate(gen, l)
        }, function (gen) {
          return generate(gen, expression(a, t.priority))
        })
      }

      return l
    } else {
      // TODO
      return function () {
        return true
      }
    }
  }

  function parse(s) {
    return generate(null, expression(tokenize(s), 0))
  }

  search.on = null

  search.loaded = cell.dedupe(false)

  cell.when(cache.loaded, function () {
    search.on = cell.bind([cache.get("search.last")], function (s) {
      try {
        return { value: parse(s) }
      } catch (e) {
        return { error: e }
      }
    })
    search.loaded.set(true)
  })
})
