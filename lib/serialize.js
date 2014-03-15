goog.provide("serialize")
goog.provide("deserialize")

goog.require("util.url")
goog.require("util.log")
goog.require("util.math")
goog.require("util.object")

goog.scope(function () {
  var url    = util.url
    , assert = util.log.assert
    , object = util.object
    , log    = util.log.log

  function get(f, x, y) {
    if (x == null) {
      return y
    } else if (y == null) {
      return x
    } else {
      return f(x, y)
    }
  }

  function min(o, x, y, s) {
    var i = get(util.math.min, x["time"][s], y["time"][s])
    if (i != null) {
      o["time"][s] = i
    }
  }

  function max(o, x, y, s) {
    var i = get(util.math.max, x["time"][s], y["time"][s])
    if (i != null) {
      o["time"][s] = i
    }
  }

  function setGroups(o, x, y) {
    assert(o["groups"] != null, o["url"])
    assert(x["groups"] != null, x["url"])
    assert(y["groups"] != null, y["url"])
    object.each(x["groups"], function (i, s) {
                           // TODO should this be min or max ?
      o["groups"][s] = get(util.math.min, i, y["groups"][s])
    })
  }

  function setTitle(o, x, y) {
    var iX = x["time"]["updated"] || x["time"]["created"]
      , iY = y["time"]["updated"] || y["time"]["created"]
    if (iX == null) {
      o["title"] = y["title"]
    } else if (iY == null) {
      o["title"] = x["title"]
    } else if (iX > iY) {
      o["title"] = x["title"]
    } else {
      o["title"] = y["title"]
    }
  }

  function set(o, x, s) {
    if (x["time"][s] != null) {
      o["time"][s] = x["time"][s]
    }
  }

  serialize.tabToDisk = function (x) {
    assert(x["groups"] != null, x["url"])

    var o = {
      "time": {
        "created": x["time"]["created"]
      },
      "groups": x["groups"],
      "title":  x["title"]
    }
    set(o, x, "updated")
    set(o, x, "focused")
    set(o, x, "unloaded")
    return o
  }

  serialize.tabFromDisk = function (x, s) {
    assert(x["groups"] != null, s)

    var o = {
      "type": "unloaded",
      "id": s,
      "url": s,
      "time": {
        "created": x["time"]["created"]
      },
      "groups": x["groups"],
      "title":  x["title"]
    }
    set(o, x, "updated")
    set(o, x, "focused")
    set(o, x, "unloaded")
    return o
  }

  serialize.setFromDisk = function (x, y) {
    setTitle(x, x, y)

    setGroups(x, y, x)

    min(x, x, y, "created")
    max(x, x, y, "updated")
    max(x, x, y, "focused")
    max(x, x, y, "unloaded")
  }

  serialize.merge = function (x, y) {
    assert(x["url"] === y["url"], x["url"] + " : " + y["url"])

    var o = {
      "time":   {},
      "groups": {}
    }

    setTitle(o, x, y)

    setGroups(o, x, y)
    setGroups(o, y, x)

    min(o, x, y, "created")
    max(o, x, y, "updated")
    max(o, x, y, "focused")
    max(o, x, y, "unloaded") // TODO should this be min or max ?
    /*if (x["pinned"] || y["pinned"]) {
      o["pinned"] = 1
    }*/

    return o
  }

  deserialize.tab = function (t, wins) {
    assert(t["groups"] != null, t["url"])

    var o = {
      type:   t["type"],
      id:     t["id"],
      url:    t["url"],
      title:  t["title"],
      pinned: !!t["pinned"],
      time: {
        created: t["time"]["created"]
      },
      groups: t["groups"]
    }
    if (t["type"] === "active") {
      o.index   = t["index"]
      o.focused = !!t["focused"]

      var id = t["window"]["id"]
      assert(id in wins)
      o.window = wins[id]
    }
    if (t["time"]["focused"] != null) {
      o.time.focused = t["time"]["focused"]
    }
    o.location = url.parseURI(o.url)
    return o
  }

  deserialize.window = function (x) {
    return {
      id: x["id"],
      name: x["name"],
      time: {
        created: x["time"]["created"]
      }
    }
  }
})
