@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:event" },
  { id: "sjs:sequence" },
  { id: "sjs:object" },
  { id: "sjs:string" },
  { id: "./util" }
])


var table_events = @Emitter()

// TODO this is an infinite buffer, what should we do if it grows too large ?
// TODO test what happens when there's multiple consumers
var table_buffer = table_events ..@buffer(Infinity)

// TODO what about retraction ?
function emit(message) {
  table_events.emit(message)
}


/**
 * toString trickery begins here
 */
// TODO sjs:string utility for this
function string_repeat(i, s) {
  return new Array(i + 1).join(s)
}

function zipLongest(array, empty) {
  // TODO hacky to use apply here, but zipLongest doesn't accept an array, it accepts arguments
  return @zipLongest.apply(null, array) ..@map(function (x) {
    return x ..@map(function (x) {
      // TODO hack needed because of missing functionality in zipLongest
      if (x == null) {
        return empty
      } else {
        return x
      }
    })
  })
}

function table_toString_decoration(columns, max, s) {
  var row = columns ..@map(function (key) {
    return string_repeat(max ..@get(key), s)
  })
  return "+#{s}" + (row ..@join("#{s}+#{s}")) + "#{s}+"
}

function table_toString_array(columns, max, values) {
  var lines = columns ..@map(function (key) {
    return values[key]
  })

  var output = lines ..zipLongest("") ..@map(function (row1) {
    var row2 = @zip(columns, row1) ..@map(function ([key, value]) {
      return value ..@padRight(max ..@get(key), " ")
    })
    return "| " + (row2 ..@join(" | ")) + " |"
  })

  return output
}

// TODO what about escapes ?
function table_toString1_escape(x) {
  return x
}

function table_toString1(x) {
  if (x == null) {
    return "null"
  } else if (typeof x === "string") {
    return "\"" + table_toString1_escape(x) + "\""
  } else {
    return "" + x
  }
}

// This is to support multi-line values (e.g. Tables within Tables, or multi-line strings)
function table_toString_multiline(max, key, value) {
  // TODO what about \r and \r\n ?
  var lines = value ..@split(/\n/g)

  lines ..@each(function (line) {
    // TODO utility for this
    if (max[key] == null) {
      max[key] = line.length
    } else {
      max[key] = Math.max(max[key], line.length)
    }
  })

  return lines
}

function table_toString() {
  var columns = this.columns ..@keys ..@map(function (x) {
    @assert.is(typeof x, "string")
    return x
  })

  var max = {}

  var header = {}
  var rows   = []

  columns ..@each(function (key) {
    var value = table_toString1_escape(key)
    header ..@setNew(key, table_toString_multiline(max, key, value))
  })

  this ..@each(function (x) {
    var o = {}

    columns ..@each(function (key) {
      var value = table_toString1(x[key])
      o ..@setNew(key, table_toString_multiline(max, key, value))
    })

    rows.push(o)
  })

  var output = []

  var decoration_border    = table_toString_decoration(columns, max, "-")
  var decoration_separator = table_toString_decoration(columns, max, "=")

  output.push(decoration_border)

  table_toString_array(columns, max, header) ..@each(function (x) {
    output.push(x)
  })

  output.push(decoration_separator)

  rows ..@each(function (row) {
    table_toString_array(columns, max, row) ..@each(function (x) {
      output.push(x)
    })
  })

  output.push(decoration_border)

  return output.join("\n")
}
/**
 * toString trickery ends here
 */


function setID(table, id, record) {
  @assert.ok(id != null)
  table.primary_index ..@setNew(id, record)
}

function remove_index(table, key, record) {
  var index = table.ref_index[key]
  if (index != null) {
    var value = record[key]
    @assert.ok(value != null)

    // TODO library function for this
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
    @assert.ok(value != null)

    // TODO library function for this
    if (index[value] == null) {
      index[value] = []
    }

    index[value]..@pushNew(record)
  }
}


exports.Table = function (info) {
  // TODO I would rather not have this return a Stream, but I currently have to, due to lack of interfaces
  var table = @Stream(function (emit) {
    table.primary_index ..@eachKeys(function (key, value) {
      emit(value) // TODO clone ?
    })
  })

  table.primary = info ..@get("primary")
  table.columns = info ..@get("columns")

  table.primary_index = {} // Create unique index for primary key

  table.ref_index = {} // Column -> ID referring to a Record in another Table -> Array of Records in this Table
  table.children  = [] // The tables that contain references to this table

  table.type_checks = {} // Column -> Function (checks that a value is correct)

  table.columns_checked = false

  table.toString = table_toString

  return table
}

// This is needed to handle self recursion and mutual recursion with refs
function check_columns(table) {
  if (!table.columns_checked) {
    table.columns ..@eachKeys(function (key, value) {
      if (value != null) {
        if (value.op === exports.ref) {
          var other_table = value.table()

          var ref_index = {}

          other_table.children.push({
            table: table,
            key: key,
            action: value.action,
            index: ref_index
          })

          table.ref_index ..@setNew(key, ref_index)

          table.type_checks ..@setNew(key, function (x) {
            @assert.is(other_table.primary_index ..@has(x), true)
          })

        } else if (value.op === exports.type) {
          var check = value.type

          table.type_checks ..@setNew(key, function (x) {
            @assert.is(check(x), true)
          })

        } else {
          @assert.fail()
        }
      }
    })

    table.columns_checked = true
  }
}

exports.changes = function (table, id) {
  if (arguments.length === 0) {
    return table_buffer
  } else if (arguments.length === 1) {
    // TODO is this correct ?
    return table_buffer ..@filter(function (x) {
      return x.table === table
    })
  } else if (arguments.length === 2) {
    // TODO is this correct ?
    return table_buffer ..@filter({ |x|
      var matches = (x.table === table && x.primary === id)
      if (matches) {
        // TODO is this the correct behavior ?
        if (x.type === exports.remove) {
          break
        } else {
          return true
        }
      } else {
        return false
      }
    }) ..@map(function (x) {
      return x.record
    })
  }
}

// TODO use try/catch to clean up stuff, maybe ?
exports.insert = function (table, x) {
  check_columns(table)

  // Create new record
  var record = {}

  var id = x[table.primary]
  setID(table, id, record)

  x ..@eachKeys(function (key, value) {
    @assert.is(table.columns ..@has(key), true)

    if (value != null) {
      var check = table.type_checks[key]
      if (check != null) {
        check(value)
      }

      record ..@setNew(key, value)

      add_index(table, key, record)
    }
  })

  emit({
    type: exports.insert,
    table: table,
    primary: id,
    record: record // TODO clone ?
  })
}

// TODO code duplication
// TODO use try/catch to clean up stuff, maybe ?
exports.update = function (table, id, x) {
  @assert.ok(id != null)

  // TODO probably unnecessary
  check_columns(table)

  // Get existing record
  var record  = table.primary_index ..@get(id)
  var before  = {}
  var after   = {}
  var changed = false

  x ..@eachKeys(function (key, value) {
    @assert.is(table.columns ..@has(key), true)

    if (value == null) {
      // Can't set the primary key to null
      // TODO this check is probably unnecessary, but better safe than sorry, right?
      @assert.isNot(key, table.primary)

      if (record[key] != null) {
        remove_index(table, key, record)

        before ..@setNew(key, record[key])
        record ..@delete(key)
        after ..@setNew(key, null)
        changed = true
      }

    } else {
      if (record[key] !== value) {
        var check = table.type_checks[key]
        if (check != null) {
          check(value)
        }

        if (record[key] == null) {
          before ..@setNew(key, null)
        } else {
          remove_index(table, key, record)
          before ..@setNew(key, record[key])
        }

        record[key] = value
        after ..@setNew(key, value)
        changed = true

        add_index(table, key, record)
      }
    }
  })

  if (changed) {
    // TODO is this try block necessary ?
    try {
      emit({
        type: exports.update,
        table: table,
        primary: id,
        record: record,
        before: before,
        after: after
      })

    } finally {
      // Update record's ID
      // Logically, this has to be after the emit
      if (after ..@has(table.primary)) {
        @assert.is(before ..@get(table.primary), id)

        var new_id = after ..@get(table.primary)
        @assert.isNot(new_id, id)

        table.primary_index ..@delete(id)
        setID(table, new_id, record)

        // TODO mark it somehow so code knows that this was generated automatically
        table.children ..@each(function (info) {
          var index = info.index[id]
          if (index != null) {
            var table   = info.table
            var primary = info.table.primary
            var action  = info.action.update
            var key     = info.key

            var changes = {}
            changes[key] = new_id

            index ..@each(function (record) {
              @assert.is(record ..@get(key), id)
              action(table, record ..@get(primary), changes)
            })
          }
        })
      }
    }
  }
}

// TODO code duplication
// TODO use try/catch to clean up stuff, maybe ?
exports.remove = function (table, id) {
  @assert.ok(id != null)

  // TODO probably unnecessary
  check_columns(table)

  // Get existing record
  var record = table.primary_index ..@get(id)

  @assert.is(record ..@get(table.primary), id)

  table.primary_index ..@delete(id)

  record ..@eachKeys(function (key, value) {
    remove_index(table, key, record)
  })

  // TODO is this try block necessary ?
  try {
    emit({
      type: exports.remove,
      table: table,
      primary: id,
      record: record
    })

  } finally {
    // TODO should this come before or after the emit ? probably after
    table.children ..@each(function (info) {
      var index = info.index[id]
      if (index != null) {
        var table   = info.table
        var primary = info.table.primary
        var action  = info.action.remove
        var key     = info.key

        var changes = {}
        changes[key] = null

        index ..@each(function (record) {
          @assert.is(record ..@get(key), id)
          action(table, record ..@get(primary), changes)
        })
      }
    })
  }
}

// TODO better error message ?
exports.error = function () {
  @assert.fail()
}

exports.ref = function (table, action) {
  if (action == null) {
    action = {}
  }
  if (action.update == null) {
    action.update = exports.update
  }
  if (action.remove == null) {
    action.remove = exports.error
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
    "focused-tab"  : @ref(-> tabs, { remove: @update }),
    "next"         : @ref(-> windows)
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
    "window"               : @ref(-> windows, { remove: @remove }),
    "next"                 : @ref(-> tabs)
  }
})


var prev = {}

each(function (x) {
  if (x.next != null) {
    prev[x.next] = x.id
  }
})
*/
