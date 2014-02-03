goog.provide("groups")

goog.require("util.cell")
goog.require("util.array")
goog.require("util.object")
goog.require("util.log")
goog.require("tabs")

goog.scope(function () {
  var cell   = util.cell
    , array  = util.array
    , object = util.object
    , log    = util.log.log
    , assert = util.log.assert

  var oGroups = {}

  groups.on         = {}
  groups.on.added   = cell.value(undefined)
  groups.on.removed = cell.value(undefined)

  groups.loaded = cell.dedupe(false)

  function addGroup(s, b) {
    if (oGroups[s] == null) {
      oGroups[s] = 0
      if (b) {
        groups.on.added.set(s)
      }
    }
    ++oGroups[s]
  }

  function remGroup(s, b) {
    assert(oGroups[s] != null)
    assert(oGroups[s] > 0)
    --oGroups[s]
    if (oGroups[s] === 0) {
      delete oGroups[s]
      if (b) {
        groups.on.removed.set(s)
      }
    }
  }

  groups.getAll = function () {
    assert(groups.loaded.get(), "groups")
    return oGroups
  }

  cell.when(tabs.loaded, function () {
    object.each(tabs.getAll(), function (x) {
      object.each(x.groups, function (_, s) {
        addGroup(s, false)
      })
    })

    /*cell.event([tabs.on.removed], function (x) {
      object.each(x.value.groups, function (_, s) {
        remGroup(s, true)
      })
    })*/

    log(oGroups)

    groups.loaded.set(true)
  })
})
