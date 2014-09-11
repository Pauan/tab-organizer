@ = require([
  { id: "sjs:object" },
  { id: "lib:extension/main" }
])

exports.init = function () {
  @button.setTooltip(@manifest ..@get("name"))

  console.info("button: finished")
}
