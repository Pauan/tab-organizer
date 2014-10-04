var id = 0

exports.key = function (name) {
  return "__unique_key_#{++id}_#{name}__"
}
