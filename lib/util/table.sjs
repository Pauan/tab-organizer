@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" },
  { id: "sjs:object" },
  { id: "sjs:string" },
  { id: "./util" }
])


var table_emit_buffering = false
var table_emit_buffer    = []
var table_emit_listeners = []

// TODO what about retraction ?
// TODO this is an infinite buffer, what should we do if it grows too large ?
function emit(message) {
  if (table_emit_listeners.length) {
    table_emit_buffer.push(message)

    if (!table_emit_buffering) {
      table_emit_buffering = true

      // TODO a little gross
      spawn (function () {
        try {
          while (table_emit_buffer.length) {
            var message = table_emit_buffer.shift()
            table_emit_listeners ..@each(function (f) {
              f(message)
            })
          }
        } catch (e) {
          console.error("THIS SHOULD NEVER HAPPEN")
          throw e
        } finally {
          table_emit_buffering = false
        }
      })()
    }
  }
}

function setID(table, id, record) {
  @assert.ok(id != null)
  // TODO sjs:object/has
  @assert.is(id in table.primary_index, false)
  table.primary_index[id] = record
}

// TODO sjs:string utility for this
function string_repeat(i, s) {
  return new Array(i + 1).join(s)
}

function table_toString_decoration(max, s) {
  var row = max ..@map(function (length) {
    return string_repeat(length, s)
  })
  return "+#{s}" + (row ..@join("#{s}+#{s}")) + "#{s}+"
}

function table_toString_values(max, values) {
  var row = @zip(values, max) ..@map(function ([value, max]) {
    return value ..@padRight(max, " ")
  })
  return "| " + (row ..@join(" | ")) + " |"
}

function table_toString() {
  var columns = this.columns ..@keys ..@map(function (x) {
    return "" + x
  })

  var max = columns ..@map(function (key) {
    return key.length
  })

  var values = []

  this ..@each(function (x) {
    var lines = columns ..@indexed ..@map(function ([i, key]) {
      var value = "" + x[key]

      // This is to support multi-line values (e.g. Tables within Tables)
      // TODO what about \r and \r\n ?
      return value ..@split(/\n/g) ..@map(function (line) {
        max[i] = Math.max(max[i], line.length)
        return line
      })
    })

    // TODO hacky to use apply here, but zipLongest doesn't accept an array, it accepts arguments
    @zipLongest.apply(null, lines) ..@each(function (x) {
      // TODO hack needed because of missing functionality in zipLongest
      values.push(x ..@map(function (x) {
        if (x == null) {
          return ""
        } else {
          return x
        }
      }))
    })
  })

  var rows = []

  var decoration_header = table_toString_decoration(max, "-")
  rows.push(decoration_header)
  rows.push(table_toString_values(max, columns))
  rows.push(table_toString_decoration(max, "="))

  values ..@each(function (x) {
    rows.push(table_toString_values(max, x))
  })

  rows.push(decoration_header)

  return rows.join("\n")
}


function remove_index(table, key, record) {
  var index = table.ref_index[key]
  if (index != null) {
    var value = record[key]

    @assert.ok(index[value] != null)
    index[value] ..@remove(record)

    if (index[value].length === 0) {
      delete index[value]
    }
  }
}

function add_index(table, key, record) {
  var index = table.ref_index[key]
  if (index != null) {
    var value = record[key]

    if (index[value] == null) {
      index[value] = []
    }

    index[value]..@pushNew(record)
  }
}


exports.Table = function (info) {
  // TODO sjs:object/has
  @assert.is("primary" in info, true)
  @assert.is("columns" in info, true)

  // TODO I would rather not have this return a Stream, but I currently have to, due to lack of interfaces
  var table = @Stream(function (emit) {
    table.primary_index ..@eachKeys(function (key, value) {
      emit(value) // TODO clone ?
    })
  })

  table.primary = info.primary
  table.columns = info.columns

  table.primary_index = {} // Create unique index for primary key

  table.ref_index = {}
  table.children  = []

  table.type_checks = {}

  table.columns ..@eachKeys(function (key, value) {
    if (value != null) {
      if (value.op === exports.ref) {
        var other_table = value.table

        var ref_index = {}

        other_table.children.push({
          table: table,
          key: key,
          action: value.action,
          index: ref_index
        })

        table.ref_index[key] = ref_index

        table.type_checks[key] = function (x) {
          // TODO sjs:object/has
          @assert.is(x in other_table.primary_index, true)
        }

      } else if (value.op === exports.type) {
        var check = value.type

        table.type_checks[key] = function (x) {
          @assert.is(check(x), true)
        }

      } else {
        @assert.fail()
      }
    }
  })

  table.toString = table_toString

  return table
}

// TODO retraction
exports.changes = function () {
  return @Stream(function (emit) {
    table_emit_listeners ..@pushNew(emit)
  })
}

// TODO use try/catch to clean up stuff, maybe ?
exports.insert = function (table, x) {
  // Create new record
  var record = {}

  var id = x[table.primary]
  setID(table, id, record)

  x ..@eachKeys(function (key, value) {
    // TODO sjs:object/has
    @assert.is(key in table.columns, true)

    if (value != null) {
      var check = table.type_checks[key]
      if (check != null) {
        check(value)
      }

      record[key] = value

      add_index(table, key, record)
    }
  })

  emit({
    type: exports.insert,
    table: table,
    record: record // TODO clone ?
  })
}

// TODO code duplication
// TODO use try/catch to clean up stuff, maybe ?
exports.update = function (table, id, x) {
  @assert.ok(id != null)

  // TODO sjs:object/has
  @assert.is(id in table.primary_index, true)

  // Get existing record
  var record  = table.primary_index[id]
  var before  = {}
  var after   = {}
  var changed = false

  // Update record's ID
  // TODO sjs:object/has
  if (table.primary in x) {
    var new_id = x[table.primary]

    @assert.isNot(new_id, id)

    delete table.primary_index[id]
    setID(table, new_id, record)

    table.children ..@each(function (info) {
      var index = info.index[id]
      if (index != null) {
        var primary = info.table.primary

        if (info.action === "update") {
          var changes = {}
          changes[info.key] = new_id

          index ..@each(function (record) {
            @assert.is(record[info.key], id)
            info.table ..exports.update(record[primary], changes)
          })

        } else {
          @assert.fail()
        }
      }
    })
  }

  x ..@eachKeys(function (key, value) {
    // TODO sjs:object/has
    @assert.is(key in table.columns, true)

    if (value == null) {
      if (record[key] != null) {
        remove_index(table, key, record)

        before[key] = record[key]
        delete record[key]
        after[key]  = null
        changed = true
      }

    } else {
      if (record[key] !== value) {
        var check = table.type_checks[key]
        if (check != null) {
          check(value)
        }

        remove_index(table, key, record)

        before[key] = record[key]
        record[key] = value
        after[key]  = value
        changed = true

        add_index(table, key, record)
      }
    }
  })

  if (changed) {
    emit({
      type: exports.update,
      table: table,
      primary: id,
      before: before,
      after: after
    })
  }
}

// TODO code duplication
// TODO use try/catch to clean up stuff, maybe ?
exports.remove = function (table, id) {
  @assert.ok(id != null)

  // TODO sjs:object/has
  @assert.is(id in table.primary_index, true)

  // Get existing record
  var record = table.primary_index[id]

  record ..@eachKeys(function (key, value) {
    remove_index(table, key, record)
  })

  // TODO sjs:object/has
  @assert.is(table.primary in record, true)
  @assert.is(record[table.primary], id)

  delete table.primary_index[id]

  table.children ..@each(function (info) {
    var index = info.index[id]
    if (index != null) {
      var primary = info.table.primary

      if (info.action === "error") {
        @assert.fail()

      } else if (info.action === "update null") {
        var changes = {}
        changes[info.key] = null

        index ..@each(function (record) {
          @assert.is(record[info.key], id)
          info.table ..exports.update(record[primary], changes)
        })

      } else if (info.action === "remove") {
        index ..@each(function (record) {
          @assert.is(record[info.key], id)
          info.table ..exports.remove(record[primary])
        })

      } else {
        @assert.fail()
      }
    }
  })

  emit({
    type: exports.remove,
    table: table,
    primary: id
  })
}

exports.ref = function (table, action) {
  if (action == null) {
    action = {}
  }
  if (action.update == null) {
    action.update = "update"
  }
  if (action.remove == null) {
    action.remove = "error"
  }
  return {
    op: exports.ref,
    table: table,
    action: action
  }
}

exports.type = function (type) {
  return {
    op: exports.type,
    type: type
  }
}


// TODO lib:util/type for these
exports.string = function (x) {
  return typeof x === "string"
}

exports.number = function (x) {
                                  // TODO hacky
  return typeof x === "number" && !isNaN(x)
}

/*exports.boolean = function (x) {
  return typeof x === "boolean"
}*/



/*function pseudo_boolean(x) {
  return x === 1 || x == null
}

var state = @Table({
  primary: "key",
  columns: {
    "key"   : @type(@string),
    "value" : null
  }
})

var options = @Table({
  connect: {
    name: "tables.options"
  },
  persist: {
    version: 1,
    name: "tables.options",
    migrate: @migrate.options
  },
  primary: "key",
  columns: {
    "key"     : @type(@string),
    "value"   : null,
    "default" : null
  }
})

var cache = @Table({
  connect: {
    name: "tables.cache"
  },
  persist: {
    version: 1,
    name: "tables.cache",
    migrate: @migrate.cache
  },
  primary: "key",
  columns: {
    "key"     : @type(@string),
    "value"   : null,
    "default" : null
  }
})

var windows = @Table({
  connect: {
    name: "tables.windows"
  },
  persist: {
    version: 1,
    name: "tables.windows",
    migrate: @migrate.windows
  },
  primary: "id",
  columns: {
    "id"           : @type(@number),
    "name"         : @type(@string),
    "time-created" : @type(@number),
    "focused-tab"  : @ref(tabs, { remove: "update null" }),
    "next"         : @ref(windows)
  }
})

var tabs = @Table({
  connect: {
    name: "tables.tabs"
  },
  persist: {
    version: 1,
    name: "tables.tabs",
    migrate: @migrate.tabs
  },
  primary: "id",
  columns: {
    "id"                   : @type(@number),
    "url"                  : @type(@string),
    "title"                : @type(@string),
    "favicon"              : @type(@string),
    "pinned"               : @type(pseudo_boolean),
    "time-created"         : @type(@number),
    "time-updated"         : @type(@number),
    "time-focused"         : @type(@number),
    "time-unfocused"       : @type(@number),
    "time-moved-in-window" : @type(@number),
    "time-moved-to-window" : @type(@number),
    "window"               : @ref(windows, { remove: "remove" }),
    "next"                 : @ref(tabs)
  }
})


var prev = {}

each(function (x) {
  if (x.next != null) {
    prev[x.next] = x.id
  }
})
*/
