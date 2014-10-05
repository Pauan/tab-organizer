// TODO test all of these functions

@ = require([
  { id: "sjs:object" },
  { id: "sjs:sequence" }
])


// TODO standard library for this
// TODO this can stack overflow, since it's not tail recursive, and it's not a plain loop either
function reduceRight(seq, init, f) {
  var done = {}

  function loop(next) {
    var x = next()
    if (x === done) {
      return init
    } else {
      return f(x, loop(next))
    }
  }

  // TODO this would be a bit cleaner if consume returned a value
  @consume(seq, done, function (next) {
    init = loop(next)
  })

  return init
}


exports.upperCase = function (s) {
  return s.toLocaleUpperCase()
}


exports.push = function (array, value) {
  return array.push(value)
}

exports.indexOf = function (array, value, def) {
  var index = array.indexOf(value)

  if (index === -1) {
    if (arguments.length === 3) {
      return def
    } else {
      throw new Error("Array #{array} does not contain #{value}")
    }
  } else {
    return index
  }
}

// TODO standard library function for this
exports.pushNew = function (array, value) {
  if (exports.indexOf(array, value, -1) !== -1) {
    throw new Error("Array #{array} already contains #{value}")
  }
  return exports.push(array, value)
}

// TODO standard library function for this
exports.spliceNew = function (array, index, value) {
  if (exports.indexOf(array, value, -1) !== -1) {
    throw new Error("Array #{array} already contains #{value}")
  }
  return array.splice(index, 0, value)
}

// TODO standard library function for this (the existing one doesn't throw an error)
exports.remove = function (array, value) {
  var index = exports.indexOf(array, value)
  array.splice(index, 1)
  return index
}

// TODO standard library function for this
exports.get_or_set = function (obj, key, setter) {
  if (obj ..@has(key)) {
    return obj ..@get(key)
  } else {
    // TODO use setNew ?
    return (obj[key] = setter())
  }
}

// TODO standard library function for this
exports.setNew = function (obj, key, value) {
  if (obj ..@has(key)) {
    throw new Error("Property #{key} already exists in object #{obj}")
  }
  obj[key] = value
}

// TODO standard library function for this
exports.set = function (obj, key, value) {
  if (!(obj ..@has(key))) {
    throw new Error("Object #{obj} does not have the key #{key}")
  }
  obj[key] = value
}

// TODO standard library function for this
exports.setUnique = function (obj, key, value) {
  if (obj ..@get(key) === value) {
    throw new Error("Object #{obj} already contains value #{value} for key #{key}")
  }
  return exports.set(obj, key, value)
}

// TODO standard library function for this
// TODO replace with .delete
exports["delete"] = function (obj, key) {
  if (!obj ..@has(key)) {
    throw new Error("Property #{key} does not exist in object #{obj}")
  }
  delete obj[key]
}

// TODO standard library function for this
exports.eachKeys = function (obj, f) {
  return obj ..@ownPropertyPairs ..@each(function ([key, value]) {
    f(key, value)
  })
}


// TODO this probably isn't super-robust, but it should work for common cases
var iMax = null

exports.uniqueID = function () {
  var x = exports.timestamp()
  if (iMax === null || x > iMax) {
    iMax = x
  } else {
    x = ++iMax
  }
  return x
}

exports.timestamp = function () {
  return Date.now()
}
