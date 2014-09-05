@ = require([
  { id: "sjs:object" }
])

// TODO standard library function for this
exports.pushNew = function (array, value) {
  if (array.indexOf(value) !== -1) {
    throw new Error("Array #{array} already contains #{value}")
  }
  return array.push(value)
}

// TODO standard library function for this
exports.spliceNew = function (array, index, value) {
  if (array.indexOf(value) !== -1) {
    throw new Error("Array #{array} already contains #{value}")
  }
  return array.splice(index, 0, value)
}

// TODO standard library function for this (the existing one doesn't throw an error)
exports.remove = function (array, value) {
  var index = array.indexOf(value)
  if (index === -1) {
    throw new Error("Array #{array} does not contain #{value}")
  }
  return array.splice(index, 1)
}

// TODO standard library function for this
exports.setNew = function (obj, key, value) {
  if (obj ..@has(key)) {
    throw new Error("Property #{key} already exists in object #{obj}")
  }
  return exports.set(obj, key, value)
}

// TODO standard library function for this
exports.set = function (obj, key, value) {
  if (obj[key] === value) {
    throw new Error("Object #{obj} already contains value #{value} for key #{key}")
  }
  obj[key] = value
}

// TODO standard library function for this
// TODO replace with .delete
exports["delete"] = function (obj, key) {
  if (!obj ..@has(key)) {
    throw new Error("Property #{key} does not exist in object #{obj}")
  }
  delete obj[key]
}


// TODO this probably isn't super-robust, but it should work for common cases
var iMax = null

exports.timestamp = function () {
  var x = Date.now()
  if (iMax === null || x > iMax) {
    iMax = x
  } else {
    x = ++iMax
  }
  return x
}
