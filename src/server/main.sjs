require("../hubs")

@ = require([
  { id: "./tabs", name: "tabs" },
  { id: "./migrate", name: "migrate" },
  { id: "./options", name: "options" },
  { id: "./popup", name: "popup" },
  { id: "./button", name: "button" },
  { id: "./counter", name: "counter" }
])

exports.init = function () {
  // Migration has to happen first, so that everything else gets the correct db format
  @migrate.init()

  waitfor {
    // Options has to be initialized before anything that uses it
    @options.init()

    waitfor {
      @popup.init()

    } and {
      // Tabs has to be here because counter relies upon it
      @tabs.init()

      @counter.init()
    }

  } and {
    @button.init()
  }

  console.info("main: finished")
}

// TODO if (require.main === module) { ?
exports.init()
