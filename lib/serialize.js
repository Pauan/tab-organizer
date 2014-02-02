goog.provide("serialize")
goog.provide("deserialize")

goog.require("util.url")
goog.require("util.cell")

goog.scope(function () {
  var url  = util.url
    , cell = util.cell

  serialize.tab = function (t) {
    // TODO hacky
    t.active = {
      index:   t.index,
      focused: t.focused,
      window:  t.window
    }

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
    if (t.active != null) {
      o["active"] = {
        "index": t.active.index,
        "focused": t.active.focused
      }
      if (t.active.window != null) {
        o["active"]["window"] = {
          "id": t.active.window.id
        }
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
        index: t["active"]["index"],
        focused: t["active"]["focused"]
      }
      if (t["active"]["window"] != null) {
        var id = t["active"]["window"]["id"]
        assert(id in wins)
        o.active.window = wins[id]
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
      name: cell.dedupe(x["name"]),
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
