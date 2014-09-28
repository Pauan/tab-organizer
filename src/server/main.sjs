require("../hubs")

@ = require([
  { id: "./session", name: "session" },
  { id: "./popup", name: "popup" },
  { id: "./button", name: "button" },
  { id: "./tabs", name: "tabs" },
  { id: "./counter", name: "counter" }
])

// TODO if (require.main === module) { ?

console.info("main: finished")
