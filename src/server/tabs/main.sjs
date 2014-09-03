@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" },
  { id: "sjs:object" },
  { id: "../util/timestamp" },
  { id: "../util/util" },
  { id: "../util/event" },
  { id: "../extension/main" }
])

exports.init = function () {
  var url_popup = @url.get("panel.html")
    , url_empty = @url.get("data/empty.html")

  var db_tabs = @db.get("current.windows", [])

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
    }
  }

  function focusTab(back) {
    var front = back_front[back.id]
    if (front != null) {
      @assert.is(back.focused, true)
      front.focused = true
      front.time.focused = @timestamp()
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

  @windows.getCurrent() ..@each(function (window) {
    window.tabs ..@each(function (tab) {
      addTab(tab)
    })
  })

  @tabs.on.add ..@listen(function (info) {
    console.log("ADD", info)
    addTab(info.tab)
  })

  @tabs.on.update ..@listen(function (info) {
    console.log("UPDATE", info)
    addOrUpdateTab(info.tab)
  })

  @tabs.on.changeId ..@listen(function (info) {
    console.log("CHANGEID", info)
    updateTabID(info.oldId, info.newId)
  })

  @tabs.on.remove ..@listen(function (info) {
    console.log("REMOVE", info)
    removeTab(info.tab)
  })

  @tabs.on.focus ..@listen(function (info) {
    console.log("FOCUS", info)
    focusTab(info.tab)
  })

  @tabs.on.unfocus ..@listen(function (info) {
    console.log("UNFOCUS", info)
    unfocusTab(info.tab)
  })

  @tabs.on.move ..@listen(function (info) {
    console.log("MOVE", info)
  })

  @tabs.on.changeParent ..@listen(function (info) {
    console.log("CHANGEPARENT", info)
  })

  console.log("started tabs")
}
