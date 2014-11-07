@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:event" },
  { id: "sjs:sequence" },
  { id: "sjs:object" },
  { id: "sjs:string" },
  { id: "sjs:observe" },
  { id: "./util" }
])


var table_events = @Emitter()

// TODO this is an infinite buffer, what should we do if it grows too large ?
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

/*function remove_index(table, key, record) {
  var index = table.ref_index[key]
  if (index != null) {
    var value = record[key]
    @assert.ok(value != null)

    // TODO library function for this
    var a = index[value]
    a ..@remove(record)

    if (a.length === 0) {
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
    var a = index[value]
    if (a == null) {
      a = index[value] = []
    }

    a ..@pushNew(record)
  }
}*/


exports.Table = function (info) {
  // TODO I would rather not have this return a Stream, but I currently have to, due to lack of interfaces
  var table = @Stream(function (emit) {
    // TODO use @values ?
    table.primary_index ..@items ..@each(function ([key, value]) {
      emit(value) // TODO clone ?
    })
  })

  table.primary = info ..@get("primary")
  table.columns = info ..@get("columns")

  table.primary_index = {} // Create unique index for primary key

  //table.ref_index = {} // Column -> ID referring to a Record in another Table -> Array of Records in this Table
  //table.children  = [] // The tables that contain references to this table

  table.type_checks = {} // Column -> Function (checks that a value is correct)

  //table.columns_checked = false

  table.toString = table_toString

  check_columns(table)

  return table
};

/*exports.toObject = function (table) {
  return table.primary_index;
};*/

// This is needed to handle self recursion and mutual recursion with refs
function check_columns(table) {
  //if (!table.columns_checked) {
    table.columns ..@items ..@each(function ([key, value]) {
      if (value != null) {
        /*if (value.op === exports.ref) {
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

        } else */if (value.op === exports.type) {
          var check = value.type

          table.type_checks ..@setNew(key, function (x) {
            @assert.is(check(x), true)
          })

        } else {
          @assert.fail()
        }
      }
    })

    //table.columns_checked = true
  //}
}

exports.ref = function (table, id, key) {
  if (arguments.length === 2) {
    return @Stream(function (emit) {
      var value = exports.get(table, id);
      if (value != null) {
        emit(value);
      }

      exports.changes(table) ..@each(function (x) {
        if (x.type === exports.insert) {
          if (x.primary === id) {
            emit(x.record);
          }
        } else if (x.type === exports.update) {
          if (x.before.primary === id) {
            @assert.is(x.after.primary, id);
            emit(x.after.record);
          }
        } else if (x.type === exports.remove) {
          // Do nothing
        } else {
          @assert.fail();
        }
      });
    });

  } else if (arguments.length === 3) {
    return exports.ref(table, id) ..@transform(function (x) {
      return x ..@get(key);
    });

  } else {
    @assert.fail();

    /*return @Stream(function (emit) {
      emit(table);

      exports.changes(table) ..@each(function (x) {
        emit(x.table);
      });
    });*/
  }
};

exports.changes = function (table) {
  if (arguments.length === 0) {
    return table_buffer;

  } else if (arguments.length === 1) {
    return table_buffer ..@filter(function (x) {
      return x.table === table;
    });

  } else {
    @assert.fail();
  }
};

exports.observe = function (f) {
  var array = [].slice.call(arguments, 1);
  array.push(f);
  return @observe.apply(null, array);
};

exports.get = function (table, id, key) {
  @assert.ok(id != null);

  var record = table.primary_index[id];
  if (arguments.length === 3) {
    return record ..@get(key);
  } else {
    return record;
  }
};

exports.insert = function (table, x) {
  //check_columns(table)

  // Create new record
  var record = {};

  x ..@items ..@each(function ([key, value]) {
    @assert.is(table.columns ..@has(key), true);

    if (value != null) {
      var check = table.type_checks[key];
      if (check != null) {
        check(value);
      }

      // @setNew
      record[key] = value;

      //add_index(table, key, record)
    }
  });

  Object.freeze(record);

  var id = record ..@get(table.primary);
  setID(table, id, record);

  emit({
    type: exports.insert,
    table: table,
    primary: id,
    record: record
  });

  return record;
};

/*
// TODO mark it somehow so code knows that this was generated automatically
function check_children(table, id, action_name, value) {
  table.children ..@each(function (info) {
    var index = info.index[id]
    if (index != null) {
      var table   = info.table
      var primary = info.table.primary
      var action  = info.action[action_name]
      var key     = info.key

      var changes = {}
      changes[key] = value

      index ..@each(function (record) {
        @assert.is(record ..@get(key), id)
        action(table, record ..@get(primary), changes)
      })
    }
  })
}*/

exports.update = function (table, id, f) {
  @assert.ok(id != null)

  // TODO probably unnecessary
  //check_columns(table)

  // Get existing record
  var record  = table.primary_index ..@get(id);
  var clone   = @clone(record);
  var before  = {};
  var after   = {};
  var changed = false;

  var x = f(record);

  @assert.is(table.primary_index ..@get(id), record);

  x ..@items ..@each(function ([key, value]) {
    @assert.is(table.columns ..@has(key), true);

    if (value == null) {
      // Can't set the primary key to null
      // TODO this check is probably unnecessary, but better safe than sorry, right?
      @assert.isNot(key, table.primary);

      if (clone[key] != null) {
        //remove_index(table, key, record)

        before ..@setNew(key, clone[key]);
        clone ..@delete(key);
        after ..@setNew(key, null);
        changed = true;
      }

    } else {
      if (clone[key] !== value) {
        var check = table.type_checks[key];
        if (check != null) {
          check(value);
        }

        if (clone[key] == null) {
          before ..@setNew(key, null);
        } else {
          //remove_index(table, key, record)
          before ..@setNew(key, clone[key]);
        }

        clone[key] = value;
        after ..@setNew(key, value);
        changed = true;

        //add_index(table, key, clone)
      }
    }
  });

  if (changed) {
    Object.freeze(clone);

    @assert.is(table.primary_index ..@get(id), record);

    var new_id = clone ..@get(table.primary);
    if (new_id === id) {
      table.primary_index[id] = clone;
    } else {
      table.primary_index ..@delete(id);
      setID(table, new_id, clone);
    }

    emit({
      type: exports.update,
      table: table,
      before: {
        primary: id,
        changes: before,
        record: record
      },
      after: {
        primary: new_id,
        changes: after,
        record: clone
      }
    });

    return clone;
  } else {
    return record;
  }
};

exports.remove = function (table, id) {
  @assert.ok(id != null);

  // TODO probably unnecessary
  //check_columns(table)

  // Get existing record
  var record = table.primary_index ..@get(id);

  @assert.is(record ..@get(table.primary), id);

  table.primary_index ..@delete(id);

  /*record ..@items ..@each(function ([key, value]) {
    remove_index(table, key, record)
  })*/

  // TODO is this try block necessary ?
  //try {
  emit({
    type: exports.remove,
    table: table,
    primary: id,
    record: record
  });

  /*} finally {
    // TODO should this come before or after the emit ? probably after
    check_children(table, id, "remove", null);
  }*/

  return record;
};
/*
// TODO better error message ?
exports.error = function () {
  @assert.fail()
}*/

/*exports.ref = function (table, action) {
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
}*/

exports.type = function (type) {
  return {
    op: exports.type,
    type: type
  };
};


/*
var prev = {}

each(function (x) {
  if (x.next != null) {
    prev[x.next] = x.id
  }
})
*/
