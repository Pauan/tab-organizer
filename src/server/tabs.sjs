@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" },
  { id: "sjs:object" },
  { id: "./timestamp" },
  { id: "./extension/main" },
  { id: "./extension/chrome/util" }
])

exports.init = function () {
  var url_popup = @url.get("panel.html")
    , url_empty = @url.get("data/empty.html")

  var db_tabs = @db.get("current.tabs", {})

  // Which tabs are active (grouped by URL)
  var active = {}

  // Backend (Chrome) to frontend (Tab Organizer)
  var back_front = {}

  // Frontend (Tab Organizer) to backend (Chrome)
  var front_back = {}

  function addActive(tab) {
    @assert.ok(tab.url != null)

    // TODO @setNew
    var a = active[tab.url]
    if (a == null) {
      a = active[tab.url] = []
    }

    a ..@pushNew(tab)
  }

  function removeActive(tab) {
    @assert.ok(tab.url != null)

    var a = active ..@get(tab.url)

    a ..@remove(tab)

    if (a.length === 0) {
      active ..@delete(tab.url)
    }
  }

  function updateLinks(front, back) {
    @assert.is(back.window.tabs[back.index], back)

    var prev = (back.window.tabs[back.index - 1] || null)
    if (prev != null) {
      prev = back_front ..@get(prev.id)
      @assert.ok(prev.next == null || prev.next === front)
      prev.next = front
    }

    var next = (back.window.tabs[back.index + 1] || null)
    if (next != null) {
      next = back_front ..@get(next.id)
      @assert.ok(next.prev == null || next.prev === front)
      next.prev = front
    }

    front.prev = prev
    front.next = next
  }

  function removeLinks(front) {
    var prev = (front.prev || null)
    var next = (front.next || null)

    if (prev != null) {
      prev.next = next
    }
    if (next != null) {
      next.prev = prev
    }
  }

  function setFromBack(front, back) {
    @assert.is(front.active, true, "can't change info of an unloaded tab")
    @assert.is(front.focused, back.focused)

    front.url = back.url
    front.favicon = back.favicon
    front.title = back.title
    front.pinned = back.pinned
  }

  function addTab(back) {
    if (back.url != null) {
      var created = @timestamp()

      var front = {
        active: true,
        id: created,
        groups: {},
        focused: back.focused,
        time: {
          created: created
        }
      }

      // TODO test this
      if (back.parentTab != null) {
        front.parent = back_front ..@get(back.parentTab.id)
      } else {
        front.parent = null
      }

      // TODO this is pretty hacky...
      setTimeout(function () {
        updateLinks(front, back)
      }, 0)

      setFromBack(front, back)

      back_front ..@setNew(back.id, front)
      front_back ..@setNew(front.id, back)

      addActive(front)
    }
  }

  function addOrUpdateTab(back) {
    var front = back_front[back.id]
    // Tab does not exist yet
    if (front == null) {
      addTab(back)

    // Tab already exists and new tab has URL
    } else if (back.url != null) {
      @assert.ok(front.url != null)

      @assert.is(back_front[back.id], front)
      @assert.is(front_back[front.id], back)

      if (front.url === back.url) {
        setFromBack(front, back)

      } else {
        removeActive(front)
        setFromBack(front, back)
        addActive(front)
      }

      front.time.updated = @timestamp()

    // Tab already exists and new tab does not have URL
    } else {
      console.log("REMOVING STALE TAB", front, back)
      // TODO split removeTab into two separate functions, so I no longer need to use this assert
      @assert.ok(back_front[back.id] != null)
      removeTab(back)
    }
  }

  function removeTab(back) {
    var front = back_front[back.id]
    if (front != null) {
      @assert.is(front_back ..@get(front.id), back)
      back_front ..@delete(back.id)
      front_back ..@delete(front.id)
      removeActive(front)
      removeLinks(front)
    }
  }

  function focusTab(back) {
    var front = back_front[back.id]
    if (front != null) {
      @assert.is(back.focused, true)
      front.focused = true
      front.time.focused = @timestamp()
      console.log(back_front)
    }
  }

  function unfocusTab(back) {
    var front = back_front[back.id]
    if (front != null) {
      @assert.is(back.focused, false)
      front.focused = false
    }
  }

  // This is necessary because Chrome sometimes changes a tab's ID
  function updateTabID(oldId, newId) {
    @assert.isNot(oldId, newId)
    var old = back_front[oldId]
    if (old != null) {
      console.log("REPLACING", old, newId)
      back_front ..@delete(oldId)
      back_front ..@setNew(newId, old)
    }
  }

  @tabs.getCurrent() ..@each(function (tab) {
    addTab(tab)
  })

  // TODO is using an infinite buffer a problem?
  // TODO is there a better way than using spawn?
  spawn @tabs.on.add ..@buffer(Infinity) ..@each(function (info) {
    //console.log("ADD", info)
    addTab(info.tab)
  })

  spawn @tabs.on.update ..@buffer(Infinity) ..@each(function (info) {
    //console.log("UPDATE", info)
    addOrUpdateTab(info.tab)
  })

  spawn @tabs.on.changeId ..@buffer(Infinity) ..@each(function (info) {
    //console.log("CHANGEID", info)
    updateTabID(info.oldId, info.newId)
  })

  spawn @tabs.on.remove ..@buffer(Infinity) ..@each(function (info) {
    //console.log("REMOVE", info)
    removeTab(info.tab)
  })

  spawn @tabs.on.focus ..@buffer(Infinity) ..@each(function (info) {
    //console.log("FOCUS", info)
    focusTab(info.tab)
  })

  spawn @tabs.on.unfocus ..@buffer(Infinity) ..@each(function (info) {
    //console.log("UNFOCUS", info)
    unfocusTab(info.tab)
  })

  spawn @tabs.on.move ..@buffer(Infinity) ..@each(function (info) {
    console.log("MOVE", info)
  })

  console.log("started tabs")
}
