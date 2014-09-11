require.hubs.addDefault(["lib:", "/"])
require.hubs.addDefault(["mho:", "/"])

@ = require([
  { id: "./tabs", name: "tabs" },
  { id: "./migrate", name: "migrate" },
  { id: "./options", name: "options" },
  { id: "./popup", name: "popup" },
  { id: "./button", name: "button" }
])

exports.init = function () {
  // Migration has to happen first, so that everything else gets the correct db format
  @migrate.init()

  // Options has to be here because if it isn't, @opt and @cache will be undefined
  @options.init()

  waitfor {
    @tabs.init()
  } and {
    @popup.init()
  } and {
    @button.init()
  }

  console.info("main: finished")
}

// TODO if (require.main === module) { ?
exports.init()
