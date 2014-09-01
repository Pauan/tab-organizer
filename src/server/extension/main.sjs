@ = require([
  { id: "./chrome/db", name: "db" },
  { id: "./chrome/tabs" },
  { id: "./chrome/url", name: "url" }
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

exports.db = @db
exports.windows = @windows
exports.tabs = @tabs
exports.url = @url
