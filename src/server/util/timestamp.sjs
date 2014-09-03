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
