@ = require([
  { id: "sjs:object" },
  { id: "./extension/main" }
])

exports.init = function () {
  @button.setTooltip(@manifest ..@get("name"))

  console.info("button: finished")
}
