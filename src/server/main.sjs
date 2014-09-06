require.hubs.addDefault(["mho:", "/"])

@ = require([
  { id: "./tabs", name: "tabs" }
])

exports.init = function () {
  waitfor {
    @tabs.init()
  } and {

  }
  console.info("main: finished")
}

// TODO if (require.main === module) { ?
exports.init()
