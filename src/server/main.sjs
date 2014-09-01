require.hubs.addDefault(["mho:", "/"])

@ = require([
  { id: "./tabs", name: "tabs" }
])

exports.init = function () {
  waitfor {
    @tabs.init()
  } and {

  }
  console.log("started main")
}

// TODO if (require.main === module) { ?
exports.init()
