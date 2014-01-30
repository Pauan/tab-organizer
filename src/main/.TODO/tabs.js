function updateUrl(o, s) {
  o.url      = s
  o.location = url.parseURI(o.url)
}

function dbTab(t, s) {
  var o = {
    time:   t.time,
    groups: t.groups,
    id:     t.time.created,
    title:  t.title
  }
  updateUrl(o, s)
  return o
}

function transfer(o1, o2, s, f) {
  if (o2[s] != null) {
    if (o1[s] == null) {
      o1[s] = o2[s]
    } else {
      o1[s] = f(o1[s], o2[s])
    }
  }
}

function checkTab(x) {
  console.assert(typeof x.title         === "string")
  console.assert(typeof x.time.created  === "number")
  console.assert(typeof x.time.focused  === "number" || x.time.focused  == null)
  console.assert(typeof x.time.unloaded === "number" || x.time.unloaded == null)

  console.assert(x.groups       != null) // TODO check that it is in fact an object
  console.assert(x.time.updated == null)
  console.assert(x.selected     == null || x.selected === 1)
}

function saveActiveTab(dTabs, s) {
  var x  = {}
  x.time = {}

  var updated = null

  array.forEach(tab_active.get(s), function (o) {
    if (o.selected) {
      x.selected = 1
    }
    if (x.groups == null) {
      x.groups = o.groups
    }
    if (updated === null || o.time.updated > updated) {
      updated = o.time.updated
      x.title = o.title
    }
    transfer(x.time, o.time, "created",  Math.min)
    transfer(x.time, o.time, "focused",  Math.max)
    transfer(x.time, o.time, "unloaded", Math.max)
  })

  checkTab(x)
  dTabs.set(s, x)
}

function saveTab(dTabs, o) {
  console.assert(typeof o.url === "string")
  var s = o.url
  if (tab_active.is(s)) {
    saveActiveTab(dTabs, s)
  } else {
    console.assert(o.active == null)
    var old = dTabs.get(s)
    console.assert(old != null)
    console.assert(o.title         === old.title)
    console.assert(o.groups        === old.groups)
    console.assert(o.time.created  === old.time.created)
    console.assert(o.time.focused  === old.time.focused)
    console.assert(o.time.unloaded === old.time.unloaded)

    var x  = {}
    x.time = {}

    if (o.selected) {
      x.selected = 1
    }
    x.groups = o.groups
    x.title  = o.title
    transfer(x.time, o.time, "created",  Math.min)
    transfer(x.time, o.time, "focused",  Math.max)
    transfer(x.time, o.time, "unloaded", Math.max)

    console.assert(x.title         === old.title)
    console.assert(x.groups        === old.groups)
    console.assert(x.time.created  === old.time.created)
    console.assert(x.time.focused  === old.time.focused)
    console.assert(x.time.unloaded === old.time.unloaded)

    checkTab(x)
    dTabs.set(s, x)
  }
}

function saveOrRemoveTab(dTabs, s) {
  if (tab_active.is(s)) {
    saveActiveTab(dTabs, s)
  } else {
    console.log(s)
    dTabs.del(s)
  }
}

tab.tabs.fromDisk = function (oNew) {
  var l = cell.dedupe(false)
  if ("current.tabs" in oNew) {
    // TODO this doesn't seem to be very correct/robust... need to check it more thoroughly
    cell.when(tab.tabs.loaded, function () {
      db.open(["current.tabs"], function (dTabs) {
        object.forEach(oNew["current.tabs"], function (t, s) {
          var o = dbTab(t, s)

          // TODO groups
          /*iter.forin(t.groups, function (s) {
            console.log(s)
            groups.add(s)
          })*/

          // TODO what about oIds or tab_active ?
          if (tab_ids.has(o.id)) {
            // TODO replace with Closure equivalent
            //o = object.deepMerge(tab_ids.get(o.id), o) // merges imported into current
          }

          console.log(o)

          tab_ids.set(o, true)
          saveTab(dTabs, o)
        })
        l.set(true)
      })
    })
  } else {
    l.set(true)
  }
  return l
}

function updateIndex(tab, b) {
  var o = oIds[tab.id]
  if (o != null) {
    console.assert(o.active.index !== tab.index)
    o.active.index = tab.index
    tab_ids.updateRaw(o, b)
  }
}

function moveChromeTab(tab, b) {
  var o = oIds[tab.id]
  if (o != null) {
    console.assert(o.active.index !== tab.index)
    o.active.index           = tab.index
    o.active.windowTimestamp = tab.window.timestamp
    o.active.windowName      = tab.window.name
    tab_ids.update(o, b)
  }
}

function removeChromeTab(tab, b) {
  var o = oIds[tab.id]
  if (o != null) {
    console.assert(tab_active.is(o.url))
    delete oIds[tab.id]

    tab_ids.remove(o, b)
    tab_active.no(o.url, o)
    saveOrRemoveTab(dTabs, o.url)
  }
}

function unfocusChromeTab(tab, b) {
  var o = oIds[tab.id]
  if (o != null) {
    console.assert(tab_active.is(o.url))
    o.active.focused = false
    tab_ids.updateRaw(o, b) // TODO should this be update or updateRaw?
  }
}

function focusChromeTab(tab, b) {
  var o = oIds[tab.id]
  if (o != null) {
    console.assert(tab_active.is(o.url))
    o.time.focused = time.timestamp()
    o.active.focused = true
    tab_ids.update(o, b)
    saveActiveTab(dTabs, o.url)
  }
}


db.open(["current.tabs"], function (dTabs) {
        var oIds = {} // Chrome Tab Id -> Tab Organizer Tab

        var unloaded = {} // Chrome Tab Id -> true if unloaded

        function removeActiveTabs(s, o, b) {
          var r = []
                                     // TODO
          array.forEach(tab_active.get(s).slice(), function (t) {
            if (o == null || o.id !== t.id) {
              console.assert(t.active)
              console.assert(t.url === s)

              var i = t.active.id
              delete oIds[i]
              unloaded[i] = true
              r.push(i)

              tab_ids.remove(t, b)
              tab_active.no(t.url, t)
            }
          })
          tabs.close(r)
        }

        function addChromeTab(tab, b) {
          var s = tab.url
          if (isValidId(s)) {
            var o = oIds[tab.id]

            if (opt.get("tabs.close.duplicates").get() && tab_active.is(s)) {
              removeActiveTabs(s, o, b)
            }

            var isFirst = !tab_active.is(s)
              , isNew   = (o == null)

            if (isNew) {
              o = oIds[tab.id] = {}
              o.time           = {}
              tab_active.yes(s, o)
            } else if (o.url !== s) {
              tab_active.yes(s, o)
              tab_active.no(o.url, o)
              saveOrRemoveTab(dTabs, o.url)
            }

            // Saved data is transfered to active tab
            if (dTabs.has(s) && isFirst) {
              var x = dTabs.get(s)
              console.assert(!tab_ids.has(o.id))
              o.selected      = x.selected
              o.time.created  = x.time.created
              o.time.focused  = x.time.focused
              o.time.unloaded = x.time.unloaded
              o.id            = o.time.created
              console.assert(tab_ids.has(o.id))
            } else if (isNew) {
              console.assert(o.id == null)
              console.assert(!tab_ids.has(o.id))
              o.time.created = time.timestamp()
              o.id           = o.time.created
              console.assert(!tab_ids.has(o.id))
            }

            // TODO is this correct?
            if (o.time.updated == null) {
              o.time.updated = o.time.created
            } else {
              o.time.updated = time.timestamp()
            }

            updateUrl(o, s)

            if (dTabs.has(s)) {
              o.groups = dTabs.get(s).groups
            } else {
              o.groups = {}
            }

            o.title = (tab.title || s)

            o.active = {
              focused:         tab.active,
              pinned:          tab.pinned,
              id:              tab.id,
              index:           tab.index,
              windowTimestamp: tab.window.timestamp,
              windowName:      tab.window.name
            }

            tab_ids.set(o, b)
            saveActiveTab(dTabs, s)
          }
        }

        windows.getAll(function (a) {
          object.forEach(dTabs.getAll(), function (t, s) {
            object.forEach(t.groups, function (_, s) {
              console.log(s)
              groups.add(s)
            })
            tab_ids.set(dbTab(t, s), false)
          })

          array.forEach(a, function (win) {
            array.forEach(win.tabs, function (tab) {
              console.assert(unloaded[tab.id] == null)
              addChromeTab(tab, false)
            })
          })

          cell.event([tabs.on.moved], function (tab) {
            console.assert(unloaded[tab.id] == null)
            moveChromeTab(tab, true)
          })

          cell.event([tabs.on.updateIndex], function (a) {
            array.forEach(a, function (tab) {
              console.assert(unloaded[tab.id] == null)
              updateIndex(tab, true)
            })
          })

          cell.event([tabs.on.replaced], function (info) {
            var x = info.oldId
              , y = info.newId

            console.assert(unloaded[x] == null)
            console.assert(unloaded[y] == null)

            var o = oIds[x]
            if (o != null) {
              delete oIds[x]
              o.active.id = y
              oIds[y] = o
            }

            // TODO should probably get rid of this
            if (unloaded[x]) {
              unloaded[y] = unloaded[x]
              delete unloaded[x]
            }
          })

          cell.event([tabs.on.created], function (tab) {
            console.assert(unloaded[tab.id] == null)
            addChromeTab(tab, true)
          })

          cell.event([tabs.on.updated], function (tab) {
            console.assert(unloaded[tab.id] == null)
            addChromeTab(tab, true)
          })

          cell.event([tabs.on.removed], function (info) {
            console.log(info.windowClosing)
            var tab = info.tab
            if (unloaded[tab.id]) {
              setTimeout(function () {
                delete unloaded[tab.id]
              }, 10000)
            // TODO shouldn't delay if the tab doesn't exist; i.e. if it has a url, or exists in oIds ?
            // TODO see if this is true when exiting Chrome
            } else if (info.windowClosing) {
              // 10 seconds, so that when Chrome exits,
              // it doesn't clobber the user's data
              db.delay(["current.tabs"], 10000, function () {
                removeChromeTab(tab, true)
              })
            } else {
              removeChromeTab(tab, true)
            }
          })

          cell.event([tabs.on.focused], function (tab) {
            console.assert(unloaded[tab.id] == null)
            focusChromeTab(tab, true)
          })

          cell.event([tabs.on.unfocused], function (tab) {
            console.assert(unloaded[tab.id] == null)
            unfocusChromeTab(tab, true)
          })

          cell.event([port.on.connect("tabs")], function (message) {
            message({ type: "all", value: tab_ids.getAll() })
          })

          cell.event([port.on.message("tabs")], function (o) {
            var x = o.value
              , s
              , r
            console.log(o.type, o.value)
            if (o.type === "addToGroup") {
              s = o.group
              array.forEach(x, function (x) {
                var t = tab_ids.get(x)
                console.assert(t.groups[s] == null) // TODO should this assert be here ?
                t.groups[s] = time.timestamp()
                console.assert(t.groups[s] != null)
                // TODO needs to update all the tabs with the same URL
                // TODO are these correct?
                tab_ids.update(t, true)
                // TODO bit inefficient
                saveTab(dTabs, t)
                groups.add(s)
              })

            } else if (o.type === "removeFromGroup") {
              s = o.group
              array.forEach(x, function (x) {
                var t = tab_ids.get(x)
                console.assert(t.groups[s] != null) // TODO should this assert be here ?
                delete t.groups[s]
                console.assert(t.groups[s] == null)
                // TODO needs to update all the tabs with the same URL
                // TODO are these correct?
                tab_ids.update(t, true)
                // TODO bit inefficient
                saveTab(dTabs, t)
                groups.remove(s)
              })

            } else if (o.type === "select") {
              array.forEach(x, function (s) {
                var t = tab_ids.get(s)
                t.selected = 1
                //tab_ids.updateRaw(t, true)
                saveTab(dTabs, t)
              })

            } else if (o.type === "deselect") {
              array.forEach(x, function (s) {
                var t = tab_ids.get(s)
                delete t.selected
                //tab_ids.updateRaw(t, true)
                saveTab(dTabs, t)
              })

            } else if (o.type === "close") {
              r = []
              array.forEach(x, function (s) {
                var t = tab_ids.get(s)
                if (t.active) {
                  r.push(t.active.id)
                } else {
                  // TODO this assumption is incorrect when importing tabs
                  console.assert(!tab_active.is(t.url))
                  tab_ids.remove(t, true)
                  dTabs.del(t.url)
                }
              })
              tabs.close(r)

            } else if (o.type === "focus") {
              var t = tab_ids.get(x)
              if (t.active) {
                tabs.focus(t.active.id)
              } else {
                tabs.open({ url: t.url })
              }

            } else if (o.type === "unload") {
              r = []
              array.forEach(x, function (s) {
                var t = tab_ids.get(s)
                if (tab_active.is(t.url)) {
                  var x = dbTab(dTabs.get(t.url), t.url)

                  console.assert(tab_active.get(t.url).indexOf(t) !== -1)

                  array.forEach(tab_active.get(t.url), function (o) {
                    console.assert(o.url === t.url)

                    if (o.id !== x.id) {
                      tab_ids.remove(o, true)
                    }

                    var i = o.active.id
                    delete oIds[i]
                    unloaded[i] = true
                    r.push(i)
                  })
                  tab_active.remove(t.url)

                  x.time.unloaded = time.timestamp()
                  tab_ids.set(x, true)
                  saveTab(dTabs, x) // TODO is this correct ?
                }
              })
              tabs.close(r)
            } else {

              console.assert()
            }
          })

          function getMidnight() {
            var o = new Date()
            o.setHours(24)
            o.setMinutes(0)
            o.setSeconds(0)
            o.setMilliseconds(0)
            return +o
          }

          ;(function sessionTimer() {
            var now  = Date.now()
              , then = getMidnight()
              , diff = then - now + 100

            console.log("sleeping for " + diff + "ms")

            function anon() {
              if (Date.now() < then) {
                setTimeout(anon, 100)
              } else {
                port.batch("tabs", { type: "midnight" })
                sessionTimer()
              }
            }
            setTimeout(anon, diff)
          })()

          tab.tabs.loaded.set(true)
        })
      })