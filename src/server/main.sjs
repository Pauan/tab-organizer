require("../hubs")

@ = require([
  { id: "./session" },
  { id: "./popup" },
  { id: "./button" },
  //{ id: "./tabs" },
  //{ id: "./counter" },
])

// TODO if (require.main === module) { ?

console.info("main: finished")
