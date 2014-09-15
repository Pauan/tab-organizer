@ = require([
  { id: "sjs:object" },
  { id: "lib:extension/client" },
  { id: "lib:util/util" },
  { id: "lib:util/observe" },
  { id: "lib:util/event" }
])


function make(port_name) {
  var o = @connection.connect(port_name)

  var opts = {}
  var defs = o.defaults

  function get(key) {
    return opts ..@get(key)
  }

  function getDefault(key) {
    return defs ..@get(key)
  }

  o.options ..@eachKeys(function (key, value) {
    opts ..@setNew(key, @Observer(value))

    get(key) ..@listen(function (value) {
      console.debug(port_name + ": setting \"" + key + "\" to " + value)

      @connection.send(port_name, {
        type: "set",
        key: key,
        value: value
      })
    })
  })

  return {
    get: get,
    getDefault: getDefault
  }
}


exports.opt = make("options")
exports.cache = make("cache")
