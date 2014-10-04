@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:object" },
  { id: "./key" }
])

exports.key_reduce = @key("reduce")
exports.key_conj   = @key("conj")
exports.key_empty  = @key("empty")

exports.reduce = function (from, to, f) {
  if (Array.isArray(from)) {
    for (var i = 0, len = from.length; i < len; ++i) {
      to = f(to, from[i])
    }
    return to
  } else {
    return (from ..@get(exports.key_reduce))(from, to, f)
  }
}

exports.conj = function (output) {
  if (Array.isArray(output)) {
    return function (output, input) {
      output.push(input)
      return output
    }
  } else {
    return (output ..@get(exports.key_conj))(output)
  }
}

exports.empty = function (output) {
  if (Array.isArray(output)) {
    return []
  } else {
    return (output ..@get(exports.key_empty))(output)
  }
}

/*function reduceRight(array, init, f) {
  var i = array.length
  while (i--) {
    init = f(array[i], init)
  }
  return init
}*/

function reduceRight1(array, f) {
  var i = array.length
  @assert.ok(i >= 1)

  var init = array[--i]
  while (i--) {
    init = f(array[i], init)
  }
  return init
}


// Ordinary function composition
// TODO maybe put it into another module ?
exports.compose = function () {
  return reduceRight1(arguments, function (before, after) {
    return function () {
      return before(after.apply(null, arguments))
    }
  })
}

exports.into = function (from, to) {
  @assert.ok(arguments.length >= 2)

  var trans = exports.compose.apply(null, [].slice.call(arguments, 2))

  return exports.reduce(from, to, trans(conj(to)))
}

exports.alter = function (from) {
  var args = [from, empty(from)].concat([].slice.call(arguments, 1))
  return exports.into.apply(null, args)
}

exports.each = function (from, f) {
  return exports.reduce(from, null, function (output, input) {
    f(input)
  })
}


exports.map = function (f) {
  return function (next) {
    return function (output, input) {
      return next(output, f(input))
    }
  }
}

exports.filter = function (f) {
  return function (next) {
    return function (output, input) {
      if (f(input)) {
        return next(output, input)
      } else {
        return output
      }
    }
  }
}

exports.mapcat = function (f) {
  return function (next) {
    return function (output, input) {
      return exports.reduce(f(input), output, next)
    }
  }
}


console.log(
  exports.into([1, 2, 3, 4], [],
               exports.mapcat(function (x) { return [x, x + 10, x + 20] })
               //exports.map(function (x) { return x + 1 }),
               //exports.filter(function (x) { return x < 4 })
              )
)


/*
foo ..@map(function (x) { ... })

foo ..@transform(@map(function (x) { ... }))

foo ..@into([], @map(function (x) { ... }))


var process1 = @compose(@map(function (x) { ... }),
                        @filter(function (x) { ... }))

var process2 = @compose(process1,
                        @map(function (x) { ... }))

[1, 2, 3] ..@transform(process1)
@ObservableArray([1, 2, 3]) ..@transform(process2)
*/
