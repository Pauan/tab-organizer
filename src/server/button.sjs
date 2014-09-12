@ = require([
  { id: "sjs:object" },
  { id: "lib:extension/server" }
])


@button.setTooltip(@manifest ..@get("name"))

console.info("button: finished")
