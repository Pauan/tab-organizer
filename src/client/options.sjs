@ = require([
  { id: "sjs:object" },
  { id: "sjs:sequence" },
  { id: "lib:extension/client" },
  { id: "lib:util/util" },
  { id: "lib:util/observe" }
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

    spawn get(key) ..@each(function (value) {
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
