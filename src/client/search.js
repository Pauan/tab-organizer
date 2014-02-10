// TODO many bugs with the search engine
goog.provide("search")

goog.require("util.cell")
goog.require("util.array")
goog.require("util.object")
goog.require("util.string")
goog.require("util.log")
goog.require("util.re")
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

  function tester(name, o) {
    var keys = sortedKeys(o)
    return function (test) {
      // TODO util.array
      for (var i = 0, iLen = array.len(keys); i < iLen; ++i) {
        if (re.test(keys[i], test)) {
          return o[keys[i]]
        }
      }
      throw new SyntaxError(name + ": expected any of [" + array.join(keys, ", ") + "]")
    }
  }

  /**
   * @constructor
   */
  /*function Lazy(f) {
    this.value = f
    this.cached = false
  }
  Lazy.prototype.get = function () {
    if (!this.cached) {
      this.value = this.value()
      this.cached = true
    }
    return this.value
  }*/

  var specials = {
    "is": tester("is", {
      "any": function () {
        return true
      },
      "bookmarked": (function () {
        // TODO have it make the tabs hidden, THEN get all the bookmarks, THEN do the search
        //var o = LUSH.bookmark.getAll()
        return function (x) {
          return x.url in o
        }
      })(),

      "broken": (function () {
        var r = [/^404 Not Found$/,
                 /^Oops! (?:Google Chrome could not |This link appears to be broken)/,
                 / is not available$/,
                 / failed to load$/]
        return function (x) {
          return array.some(r, function (r) {
            return re.test(x.title, r)
          })
        }
      })(),

      "child": null, // TODO

      // TODO isn't this just same:url ?
      "duplicated": function (x) {
        // TODO
        return x.inChrome > 1
      },

      "image": (function () {
        var url   = /\.\w+(?=[#?]|$)/
          , title = /\(\d+×\d+\)$/
        return function (x) {
          // TODO util.regexp
          return re.test(x.url, url) && re.test(x.title, title)
        }
      })(),

      "pinned": function (x) {
        return x.pinned
      },

      // TODO
      /*"selected": function (x) {
        return $.hasClass(x, "selected")
      },*/

      "unloaded": function (x) {
        // TODO
        return x.inChrome === 0
      }
    }),
    /* TODO move this elsewhere, probably platform.tabs
    "same": new Lazy(function () {
      var funcs = {
        // TODO
        "domain": function (x) {
          return x.location.domain
        },
        "file": function (x) {
          return x.location.domain + x.location.path + x.location.file
        },
        "path": function (x) {
          return x.location.domain + x.location.path
        },
        "title": function (x) {
          return x.title
        },
        "url": function (x) {
          return x.url
        }
      }

      var aKeys = object.keys(funcs)

      var types = {}

      var o = {}
      array.each(aKeys, function (s) {
        var f = funcs[s]
        o[s] = function (x) {
          return types[s][f(x)] >= 2
        }
      })

      function add(x) {
        array.each(aKeys, function (s) {
          var title = funcs[s](x)
            , o     = types[s]
          if (o[title] == null) {
            o[title] = 0
          }
          ++o[title]
        })
      }

      function rem(x) {
        object.each(funcs, function (f, s) {
          var title = f(x)
            , o     = types[s]
          assert(o[title] != null)
          assert(o[title] > 0)
          --o[title]
          if (o[title] === 0) {
            delete o[title]
          }
        })
      }

      // TODO inefficient
      cell.bind([tabs.all], function (o) {
        array.each(aKeys, function (s) {
          types[s] = {}
        })
        object.each(o, add)
        log("HIYA!!!")
      })

      cell.event([tabs.on.opened], add)
      cell.event([tabs.on.updated], add)
      cell.event([tabs.on.updatedOld], rem)
      cell.event([tabs.on.closed], rem)

      return tester("same", o)
    }),*/
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
        return test(x.url)
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
        return test(x.title)
      }
    },
    "group": function (test) {
      test = test()
      return function (x) {
        var b
        // TODO inefficient
        object.each(x.groups, function (_, s) {
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
    array.sort(aKeys, util.string.upperSorter)
    return aKeys
  }

  function negate(left, x) {
    if (x.op === "-") {
      return {
        op: "-",
        right: negate(left, x.right)
      }
    } else {
      // TODO test this and put in a better error message
      assert(x.string != null)
      return {
        op: ":",
        left: left,
        right: x.string
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
      infix: function (x, a, l) {
        var left  = l.string
          , right = parse(a, x.priority)

        if (left == null || typeof left !== "string" || specials[left] == null) {
          throw new SyntaxError("expected any of [" + array.join(sortedKeys(specials), ", ") + "] but got " + left)
        }

        var r = []
        comma(r, left, right)

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

        var f = specials[left]
        /*if (f instanceof Lazy) {
          f = f.get()
        }*/
        return f(re.make("^" + re.escape(right)))
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
        if (t.infix == null) {
          throw new SyntaxError("expected infix operator but got " + t.name)
        }
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
        return re.test(tab.url, y) || re.test(tab.title, y)
      }
    } else {
      // TODO needs to be moved into the parse stage ?
      assert(x.op in tokens)
      return tokens[x.op].compile(x)
    }
  }

  search.loaded = cell.dedupe(false)

  cell.when(cache.loaded, function () {
    var parsed = cell.bind([cache.get("search.last")], function (s) {
      try {
        return { value: compile(parse(tokenize(s), 0)) }
      } catch (e) {
        return { error: e["message"] || "" }
      }
    })

    search.error = cell.bind([parsed], function (s) {
      if (s.error != null) {
        return s.error
      } else {
        return false
      }
    })


    search.value = cell.bind([parsed], function (s) {
      if (s.value != null) {
        return s.value
      } else {
        return false
      }
    })

    /*function check(f, x) {
      if (f == null) {
        x.visible.set(true)
      } else {
        x.visible.set(f(x))
      }
    }

    function wrap(o) {
      var r = cell.value(o.get())
      cell.event([o], function (x) {
        check(compiled.get(), x)
        r.set(x)
      })
      return r
    }

    tabs.on.opened     = wrap(tabs.on.opened)
    tabs.on.updated    = wrap(tabs.on.updated)
    tabs.on.focused    = wrap(tabs.on.focused)
    tabs.on.unfocused  = wrap(tabs.on.unfocused)
    tabs.on.selected   = wrap(tabs.on.selected)
    tabs.on.deselected = wrap(tabs.on.deselected)*/

    search.loaded.set(true)
  })
})
