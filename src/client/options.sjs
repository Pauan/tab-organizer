@ = require([
  { id: "lib:extension/client" },
  { id: "lib:util/util" },
  { id: "lib:util/observe" },
  { id: "lib:util/event" }
])


function make(port_name) {
  var o = @connection.connect(port_name)

  var opts = {}

  function get(key) {
    return opts ..@get(key)
  }

  o.options ..@eachKey(function (key, value) {
    opts ..@setNew(key, @Observer(value))

    get(key) ..@listen(function (value) {
      @connection.send(port_name, {
        type: "set",
        key: key,
        value: value
      })
    })
  })

  return {
    get: get
  }
}


exports.opt = make("options")
exports.cache = make("cache")
