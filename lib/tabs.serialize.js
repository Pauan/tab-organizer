goog.provide("tabs.serialize")

goog.scope(function () {
  tabs.serialize.serialize = function (t) {
    /** @dict */
    var o = {
      "id":    t.id,
      "url":   t.url,
      "title": t.title,
      "time": {
        "created": t.time.created
      },
      "groups": {}
    }
    if (t.active) {
      o["active"] = {
        "index": t.active.index
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
      groups: {}
    }
    if (t["active"]) {
      o.active = {
        index: t["active"]["index"]
      }
    }
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
