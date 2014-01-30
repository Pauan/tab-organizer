goog.provide("platform.db")

goog.require("util.Symbol")
goog.require("util.cell")
goog.require("util.array")
goog.require("util.log")
goog.require("util.func")
goog.require("util.type")

goog.scope(function () {
  var Symbol = util.Symbol
    , cell   = util.cell
    , array  = util.array
    , log    = util.log.log
    , func   = util.func
    , type   = util.type

  var store = chrome["storage"]["local"]
    , _db   = Symbol("db")
    , _name = Symbol("name")
    , dbs   = null

  // When the db updates, it will wait for 1000ms, and will then commit the changes
  // If you use the delay function, it will reset the timer and will delay by the amount you specify
  var bTimer = {} // whether the timer is currently ticking
    , iDelay = {} // the delay for the timer
    , iTimer = {} // the setTimeout id to stop the timer
    , oQueue = {} // action to take when the timer is up

  function updateRaw(s) {
    if (!bTimer[s] && oQueue[s] != null) {
      bTimer[s] = true
      iTimer[s] = setTimeout(function () {
        log("saving database:", s)
        oQueue[s]()
        delete oQueue[s]
        delete iDelay[s]
        delete bTimer[s]
      }, iDelay[s] || 1000)
    }
  }

  function update(s, v) {
    oQueue[s] = function () {
      var o = {}
      o[s] = v
      store["set"](o)
    }
    updateRaw(s)
  }

  function checkLoaded() {
    if (!platform.db.loaded.get()) {
      throw new Error("platform.db not loaded")
    }
  }

  platform.db.loaded = cell.dedupe(false)

  platform.db.delay = function (s, i, f) {
    checkLoaded()

    if (type.isString(s)) {
      s = [s]
    }
    array.each(s, function (s) {
      clearTimeout(iTimer[s])
      iDelay[s] = i
      delete bTimer[s]
    })
    try {
      f()
    } finally {
      array.each(s, function (s) {
        updateRaw(s)
      })
    }
  }

  /**
   * @constructor
   */
  function Raw(s) {
    this[_name] = s
  }
  Raw.prototype.has = function () {
    return this[_name] in dbs
  }
  Raw.prototype.get = function () {
    return dbs[this[_name]]
  }

  Raw.prototype.set = function (v) {
    dbs[this[_name]] = v
    update(this[_name], v)
  }
  Raw.prototype.del = function () {
    var name = this[_name]
    delete dbs[name]
    oQueue[name] = function () {
      store["remove"](name)
    }
    updateRaw(name)
  }

  Raw.prototype.setNew = function (v) {
    if (!this.has()) {
      this.set(v)
    }
    return this.get()
  }

  /**
   * @constructor
   */
  function Open(sDB) {
    if (dbs[sDB] == null) {
      dbs[sDB] = {}
    }
    this[_name] = sDB
    this[_db]   = dbs[sDB]
  }

  Open.prototype.has = function (s) {
    return s in this[_db]
  }
  Open.prototype.get = function (s) {
    return this[_db][s]
  }
  Open.prototype.getAll = function () {
    return this[_db] // TODO should probably return a copy or something
  }

  Open.prototype.set = function (s, v) {
    this[_db][s] = v
    update(this[_name], this[_db])
  }
  Open.prototype.del = function (s) {
    delete this[_db][s]
    update(this[_name], this[_db])
  }
  Open.prototype.setAll = function (x) {
    this[_db] = dbs[this[_name]] = x
    update(this[_name], this[_db])
  }

  // TODO delete it rather than setting it to {} ?
  Open.prototype.delAll = function () {
    this.setAll({})
  }
  Open.prototype.setNew = function (s, v) {
    if (!this.has(s)) {
      this.set(s, v)
    }
    return this.get(s)
  }
  Open.prototype.move = function (x, y) {
    if (this.has(x)) {
      this.set(y, this.get(x))
      this.del(x)
    }
  }
  Open.prototype.moveValue = function (s, sOld, sNew) {
    if (this.has(s) && this.get(s) === sOld) {
      this.set(s, sNew)
    }
  }

  platform.db.raw = function (s, f) {
    checkLoaded()

    if (type.isString(s)) {
      s = [s]
    }
    func.apply(f, null, array.map(s, function (s) {
      return new Raw(s)
    }))
  }

  platform.db.open = function (s, f) {
    checkLoaded()

    if (type.isString(s)) {
      s = [s]
    }
    func.apply(f, null, array.map(s, function (s) {
      return new Open(s)
    }))
  }

  platform.db.del = function (sDB) {
    platform.db.raw(sDB, function (o) {
      o.del()
    })
  }

  platform.db.getAll = function () {
    checkLoaded()
    return dbs // TODO should probably return a copy
  }

  // TODO what about existing connections?
  platform.db.delAll = function () {
    checkLoaded()

    dbs = {}
    store["clear"]()
  }

  store["get"](null, function (o) {
    dbs = o
    platform.db.loaded.set(true)
  })
})
