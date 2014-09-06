@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" },
  { id: "sjs:object" },
  { id: "../util/util" },
  { id: "../util/event" },
  { id: "../extension/main" },
  { id: "./link", name: "link" }
])

exports.init = function () {
  var url_popup = @url.get("panel.html")
    , url_empty = @url.get("data/empty.html")

  var db_windows = @db.get("current.windows.array", [])

  function save() {
    //@db.set("current.windows.array", db_windows)
  }

  // TODO library function for this ?
  function setNull(obj, key, value) {
    if (value != null) {
      obj[key] = value
    } else {
      delete obj[key]
    }
  }

  // TODO library function for this ?
  function setBoolean(obj, key, value) {
    if (value) {
      obj[key] = 1
    } else {
      delete obj[key]
    }
  }

  function setFromBack(front, back) {
    if (front.active == null) {
      front.active = {}
    }

    front.active.focused = back.focused

    front ..setNull("url", back.url)
    front ..setNull("favicon", back.favicon)
    front ..setNull("title", back.title)
    front ..setBoolean("pinned", back.pinned)
  }


  function addWindow(tabs) {
    var created = @timestamp()

    return {
      id: created,
      // This isn't here in order to cut down on db size
      // name: null,
      time: {
        created: created
      },
      children: tabs ..@map(function (back) {
        var front = addTab(back)
        @link.tabs.create(front, back)
        return front
      })
    }
  }

  function addTab(back) {
    var created = @timestamp()

    var front = {
      // This isn't here in order to cut down on db size
      // active: null,
      id: created,
      groups: {},
      time: {
        created: created
      }
    }

    setFromBack(front, back)

    return front
  }

  function getLastIndexForParent(tab, window) {
    var index = window.children.indexOf(tab)
    @assert.isNot(index, -1)

    while (index < window.children.length) {

      ++index
    }

    return index
  }

  function moveTab(front, back) {
    @assert.is(back.window.tabs[back.index], back)

    var window = @link.windows.fromBack(back.window)

    var prev = back.window.tabs[back.index - 1]
    if (prev != null) {
      prev = @link.tabs.fromBack(prev)

      var index = getLastIndexForParent(prev, window)
      window.children ..@spliceNew(index, front)
    } else {
      var next = back.window.tabs[back.index + 1]
      if (next != null) {
        next = @link.tabs.fromBack(next)

      } else {
        window.children ..@pushNew(front)
      }
    }

    /*if (back.parentTab == null) {
      @assert.is(back.index, back.window.tabs.length - 1)
      window.children ..@pushNew(front)
    } else {

    }*/
    //console.log(back.window, @link.windows.fromBack(back.window))
  }

  function updateTab(back) {
    var front = @link.tabs.fromBack(back)

    setFromBack(front, back)
    front.time.updated = @timestamp()

    return front
  }

  function focusTab(back) {
    var front = @link.tabs.fromBack(back)

    @assert.is(back.focused, true)
    @assert.ok(front.active != null)
    @assert.is(front.active.focused, false)

    front.active.focused = true
    front.time.focused = @timestamp()

    return front
  }

  function unfocusTab(back) {
    var front = @link.tabs.fromBack(back)

    @assert.is(back.focused, false)
    @assert.ok(front.active != null)
    @assert.is(front.active.focused, true)

    front.active.focused = false

    return front
  }

  // { children: [addTab({ id: 9001, url: "https://trello.com/b/bblpxA84/tab-organizer" })] }

  //mergeBack(db_windows, @windows.getCurrent())
  //save()
  console.log(db_windows)

  @windows.on.add ..@listen(function (info) {
    console.log("ADD WINDOW", info)
    /*var back = info.window
    var front = addWindow(back.tabs)

    @link.windows.create(front, back)
    db_windows.push(front)
    save()*/
  })

  @windows.on.remove ..@listen(function (info) {
    console.log("REMOVE WINDOW", info)
    /*var back = info.window
    var front = @link.windows.fromBack(back)

    @link.windows.remove(front, back)
    db_windows ..@remove(front)
    save()

    setTimeout(function () {
      save()
    }, 10000)*/
  })

  @tabs.on.add ..@listen(function (info) {
    console.log("ADD", info)
    /*var back = info.tab
    var front = addTab(back)

    @link.tabs.create(front, back)
    @link.tabs.setWindow(front, @link.windows.fromBack(back.window))
    moveTab(front, back)
    save()*/
  })

  // TODO remove from array too
  @tabs.on.remove ..@listen(function (info) {
    console.log("REMOVE", info)
    /*var back = info.tab
    var front = @link.tabs.fromBack(back)

    @link.tabs.remove(front, back)
    @link.tabs.getWindow(front).children ..@remove(front)
    setTimeout(function () {
      save()
    }, 10000)*/
  })

  @tabs.on.update ..@listen(function (info) {
    console.log("UPDATE", info)
    /*updateTab(info.tab)
    save()*/
  })

  @tabs.on.focus ..@listen(function (info) {
    console.log("FOCUS", info)
    /*focusTab(info.tab)
    save()*/
  })

  @tabs.on.unfocus ..@listen(function (info) {
    console.log("UNFOCUS", info)
    //unfocusTab(info.tab)
  })

  @tabs.on.move ..@listen(function (info) {
    console.log("MOVE", info)
  })

  console.info("tabs: started tabs")
}
