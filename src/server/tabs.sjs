@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" },
  { id: "./timestamp" },
  { id: "./extension/main" }
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

    var a = active[tab.url]
    if (a == null) {
      a = active[tab.url] = []
    }

    @assert.ok(a.indexOf(tab) === -1)
    a.push(tab)
  }

  function removeActive(tab) {
    @assert.ok(tab.url != null)

    var a = active[tab.url]
    @assert.ok(a != null)

    var index = a.indexOf(tab)
    @assert.ok(index !== -1)
    a.splice(index, 1)

    if (a.length === 0) {
      delete active[tab.url]
    }
  }

  function setFromBack(front, back) {
    @assert.isNot(front.type, "unloaded", "can't change info of an unloaded tab")

    front.type = "active"
    front.url = back.url
    front.title = back.title
    front.pinned = back.pinned
    front.focused = back.focused

    @assert.isNot(front_back[front.id], back)
    front_back[front.id] = back
  }

  function addTab(back) {
    if (back.url != null) {
      var created = @timestamp()

      var front = {
        id: created,
        groups: {},
        time: {
          created: created
        }/*,
        window: {
          id:
        }*/
      }

      @assert.ok(back_front[back.id] == null)
      @assert.ok(front_back[front.id] == null)
      setFromBack(front, back)
      back_front[back.id] = front

      addActive(front)
      console.log("addTab", front)
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
      if (front.url === back.url) {
        @assert.is(back_front[back.id], front)
        @assert.ok(front_back[front.id] != null)
        setFromBack(front, back)

      } else {
        removeActive(front)

        // TODO code duplication
        @assert.is(back_front[back.id], front)
        @assert.ok(front_back[front.id] != null)
        setFromBack(front, back)

        addActive(front)
      }

    // Tab already exists and new tab does not have URL
    } else {
      console.log("REMOVING STALE TAB", front, back)
      // TODO code duplication with removeTab
      var old_back = front_back[front.id]
      @assert.ok(old_back != null)
      @assert.isNot(old_back, back)
      @assert.is(old_back.id, back.id)
      delete back_front[back.id]
      delete front_back[front.id]
      removeActive(front)
    }
  }

  function removeTab(back) {
    var front = back_front[back.id]
    if (front != null) {
      @assert.ok(front_back[front.id] != null)
      @assert.is(front_back[front.id], back)
      delete back_front[back.id]
      delete front_back[front.id]
      removeActive(front)
    }
  }

  // This is necessary because Chrome sometimes changes a tab's ID
  function updateTabID(info) {
    @assert.isNot(info.old.id, info.tab.id)
    var old = back_front[info.old.id]
    if (old != null) {
      console.log("REPLACING", info.old, info.tab)
      delete back_front[info.old.id]
      back_front[info.tab.id] = old
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

  spawn @tabs.on.replace ..@buffer(Infinity) ..@each(function (info) {
    updateTabID(info)
    addOrUpdateTab(info.tab)
  })

  spawn @tabs.on.remove ..@buffer(Infinity) ..@each(function (info) {
    //console.log("REMOVE", info)
    removeTab(info.tab)
  })

  spawn @tabs.on.focus ..@buffer(Infinity) ..@each(function (info) {
    console.log("FOCUS", info.old, info.tab)
  })

  console.log("started tabs")
}
