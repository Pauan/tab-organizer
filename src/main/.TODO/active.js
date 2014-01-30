goog.provide("tab.active")

goog.scope(function () {
  var oActive = {} // Tab Organizer URL -> [Tab Organizer Tab]

  tab.active.remove = function (s) {
    console.assert(oActive[s] != null)
    delete oActive[s]
  }

  tab.active.get = function (s) {
    console.assert(oActive[s] != null)
    return oActive[s]
  }

  tab.active.yes = function (s, x) {
    var a = oActive[s]
    if (a == null) {
      a = oActive[s] = []
    }
    var i = a.indexOf(x)
    if (i === -1) {
      a.push(x)
    }
  }

  tab.active.no = function (s, x) {
    var a = oActive[s]
      , i = a.indexOf(x)
    if (i !== -1) {
      a.splice(i, 1)
      if (a.length === 0) {
        delete oActive[s]
      }
    }
  }

  tab.active.is = function (s) {
    return oActive[s] != null
  }
})