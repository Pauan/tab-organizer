@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "./util" }
])


exports.Table = function (info) {
  var o = Object.create(exports.Table.prototype)
  o.data = {}

  o.primary_key = null

  o.internal_refs = {}
  o.external_refs = []

  o.checks = {}

  info ..@eachKeys(function (key, value) {
    if (value.op === exports.primary) {
      @assert.is(o.primary_key, null)
      o.primary_key = key
      @assert.isNot(o.primary_key, null)

      var check = value.type

      o.checks[key] = function (x) {
        @assert.is(check(x), true)
      }

    } else if (value.op === exports.ref) {
      var other_table = value.table

      o.internal_refs[key] = {}

      other_table.external_refs.push(o.internal_refs[key])

      o.checks[key] = function (x) {
        @assert.is(x === null || other_table ..exports.has(x), true)
      }

    } else if (value.op === exports.type) {
      var check = value.type

      o.checks[key] = function (x) {
        @assert.is(x === null || check(x), true)
      }

    } else {
      @assert.fail()
    }
  })

  @assert.isNot(o.primary_key, null)

  return o
}

exports.has = function (id) {
  // TODO sjs:object/has ?
  return id in o.data
}

// TODO handle internal_refs
exports.insert = function (table, x) {
  table.checks ..@eachKeys(function (key, check) {
    // TODO x ..@get(key)
    @assert.is(key in x, true)
    var value = x[key]
    check(value)

    // TODO test this
    var refs = table.internal_refs[key]
    if (refs != null) {
      if (refs[value] == null) {
        refs[value] = 1
      } else {
        ++refs[value]
      }
    }
  })

  // TODO x ..@get(table.primary_key)
  // TODO this may be redundant, since primary_key is a part of checks
  @assert.is(table.primary_key in x, true)

  var key = x[table.primary_key]
  // TODO table.data ..@setNew(key, x)
  @assert.is(key in table.data, false)

  table.data[key] = x
}

// TODO code duplication
exports.update = function (table, x) {
  // TODO x ..@get(table.primary_key)
  // TODO this may be redundant, since primary_key is a part of checks
  @assert.is(table.primary_key in x, true)

  var key = x[table.primary_key]
  // TODO table.data ..@get(key)
  @assert.is(key in table.data, true)

  var old = table.data[key]

  table.checks ..@eachKeys(function (key, check) {
    // TODO x ..@get(key)
    @assert.is(key in x, true)
    var new_value = x[key]
    check(new_value)

    // TODO test this
    var refs = table.internal_refs[key]
    if (refs != null) {
      var old_value = old[key]

      @assert.is(old_value in refs, true)
      @assert.is(refs[old_value] >= 1, true)

      if (old_value !== new_value) {
        --refs[old_value]
        if (refs[old_value] === 0) {
          delete refs[old_value]
        }

        if (refs[new_value] == null) {
          refs[new_value] = 1
        } else {
          ++refs[new_value]
        }
      }
    }
  })

  // TODO table.data ..@set(key, x)
  table.data[key] = x
}

// TODO code duplication
exports.remove = function (table, x) {
  // TODO x ..@get(table.primary_key)
  // TODO this may be redundant, since primary_key is a part of checks
  @assert.is(table.primary_key in x, true)

  var key = x[table.primary_key]
  // TODO table.data ..@get(key)
  @assert.is(key in table.data, true)
  @assert.is(table.data[key], x)

  // TODO test this
  table.external_refs ..@each(function (x) {
    // TODO sjs:object/has
    @assert.is(key in x, false)
  })

  // TODO test this
  table.internal_refs ..@eachKeys(function (key, refs) {
    // TODO @get
    @assert.is(key in x, true)
    var value = x[key]

    @assert.is(value in refs, true)
    @assert.is(refs[value] >= 1, true)

    --refs[value]
    if (refs[value] === 0) {
      delete refs[value]
    }
  })

  // TODO @delete
  delete table.data[key]
}

exports.primary = function (type) {
  return {
    op: exports.primary,
    type: type
  }
}

exports.ref = function (table) {
  return {
    op: exports.ref,
    table: table
  }
}

exports.type = function (type) {
  return {
    op: exports.type,
    type: type
  }
}


exports.string = function (x) {
  return typeof x === "string"
}

exports.number = function (x) {
                                  // TODO hacky
  return typeof x === "number" && !isNaN(x)
}

exports.boolean = function (x) {
  return typeof x === "boolean"
}



var windows = @Table({
  "id"           : @primary(@type(@number)),
  "name"         : @type(@string),
  "time-created" : @type(@number),
  "focused-tab"  : @ref(tabs),
  "next"         : @ref(windows)
})

var tabs = @Table({
  "id"                   : @primary(@type(@number)),
  "url"                  : @type(@string),
  "title"                : @type(@string),
  "favicon"              : @type(@string),
  "pinned"               : @type(@boolean),
  "time-created"         : @type(@number),
  "time-updated"         : @type(@number),
  "time-focused"         : @type(@number),
  "time-unfocused"       : @type(@number),
  "time-moved-in-window" : @type(@number),
  "time-moved-to-window" : @type(@number),
  "window"               : @ref(windows),
  "next"                 : @ref(tabs)
})

var prev = {}
var next = {}

each(function (x) {
  prev[x.next] = x.id

  if (x.next) {
    x.next.prev = x.id
  }
})

each(function (x) {
  if (x.prev !== null) {
    x.prev.next = x.id
    next[x.prev] = x.id
  } else {
    x.prev.next = null
  }
})

reduce(null, function (prev, next) {
  next.prev = prev
  return next.id
})

var active_tabs = @Table({
  "id": @primary(@ref(tabs, "id")),
  "focused": @type(@boolean)
})
