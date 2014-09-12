require("../hubs")

@ = require([
  { id: "./tabs" },
  { id: "./popup" },
  { id: "./button" },
  { id: "./counter" }
])

// TODO if (require.main === module) { ?

console.info("main: finished")
