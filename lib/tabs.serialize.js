goog.provide("tabs.serialize")

goog.require("util.url")

goog.scope(function () {
  var url = util.url

  tabs.serialize.serialize = function (t) {
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
          "name": t.active.window.name,
          "time": {
            "created": t.active.window.time.created
          }
        }
      }
    }
    if (t.pinned) {
      o["pinned"] = t.pinned
    }
    if (t.focused) {
      o["focused"] = t.focused
    }
    if (t.time.focused != null) {
      o["time"]["focused"] = t.time.focused
    }
    return o
  }

  tabs.serialize.deserialize = function (t) {
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
        o.active.window = {
          name: t["active"]["window"]["name"],
          time: {
            created: t["active"]["window"]["time"]["created"]
          }
        }
      }
    }
    o.location = url.parseURI(o.url)
    if (t["pinned"]) {
      o.pinned = t["pinned"]
    }
    if (t["focused"]) {
      o.focused = t["focused"]
    }
    if (t["time"]["focused"] != null) {
      o.time.focused = t["time"]["focused"]
    }
    return o
  }

  function set(o, tab, s) {
    if (tab["time"][s] != null) {
      o["time"][s] = tab["time"][s]
    }
  }

  tabs.serialize.tabToDisk = function (tab) {
    /** @dict */
    var o       = {}
    o["time"]   = {}
    o["groups"] = tab["groups"]
    o["title"]  = tab["title"]

    set(o, tab, "created")
    set(o, tab, "focused")
    set(o, tab, "unloaded")
    //set(o, tab, "updated")
    return o
  }
})
