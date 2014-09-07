require.hubs.addDefault(["mho:", "/"])

@ = require([
  { id: "./tabs", name: "tabs" },
  { id: "./migrate", name: "migrate" }
])

exports.init = function () {
  @migrate.init()

  waitfor {
    @tabs.init()
  } and {

  }

  console.info("main: finished")
}

// TODO if (require.main === module) { ?
exports.init()
