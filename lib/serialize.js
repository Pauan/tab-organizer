goog.provide("serialize")
goog.provide("deserialize")

goog.require("util.url")
goog.require("util.log")

goog.scope(function () {
  var url    = util.url
    , assert = util.log.assert

  serialize.tab = function (t) {
    /** @dict */
    var o = {
      "id":    t.id,
      "url":   t.url,
      "title": t.title,
      "time": {
        "created": t.time.created
      },
      "groups": {} // TODO
    }
    if (t.window != null) {
      o["active"] = {
        "index": t.index,
        "window": {
          "id": t.window.id
        }
      }
      if (t.focused) {
        o["active"]["focused"] = 1
      }
    }
    if (t.pinned) {
      o["pinned"] = 1
    }
    if (t.time.focused != null) {
      o["time"]["focused"] = t.time.focused
    }
    return o
  }

  serialize.window = function (win) {
    return {
      "id": win.id,
      "name": win.name,
      "time": {
        "created": win.time.created
      }
    }
  }

  deserialize.tab = function (t, wins) {
    var o = {
      id:    t["id"],
      url:   t["url"],
      title: t["title"],
      time: {
        created: t["time"]["created"]
      },
      groups: t["groups"]
    }
    if (t["active"] != null) {
      o.active = {
        index: t["active"]["index"]
      }
      if (t["active"]["window"] != null) {
        var id = t["active"]["window"]["id"]
        assert(id in wins)
        o.active.window = wins[id]
      }
      if (t["active"]["focused"]) {
        o.focused = t["active"]["focused"]
      }
    }
    if (t["pinned"]) {
      o.pinned = t["pinned"]
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

  function set(o, tab, s) {
    if (tab["time"][s] != null) {
      o["time"][s] = tab["time"][s]
    }
  }

  serialize.tabToDisk = function (tab) {
    /** @dict */
    var o       = {}
    o["time"]   = {}
    o["groups"] = tab["groups"]
    o["title"]  = tab["title"]

    /*if (tab["pinned"]) {
      o["pinned"] = 1
    }*/

    set(o, tab, "created")
    set(o, tab, "updated")
    set(o, tab, "focused")
    set(o, tab, "unloaded")
    return o
  }
})
