@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "sjs:sequence" },
  { id: "lib:extension/client" },
  { id: "lib:util/dom" },
  { id: "../util" },
  { id: "../../options", name: "top_options" }
])

exports.top = function () {
  return @options.category("User Data", [
    @Div([
      @options.button("Export", function () {
        var s = @connection.command("db.export", null)

        @assert.ok(s != null)

        // TODO I don't like this
        var o = {}
        @copy(o, s, "current.windows.array")
        @copy(o, s, "options.user")
        @copy(o, s, "options.cache")
        @copy(o, s, "undo")
        @copy(o, s, "version")

        var date = new Date().toISOString().slice(0, 10) // TODO is this slice a good idea ?

        @saveFilePicker(JSON.stringify(o, null, 2), {
          type: "application/json",
          name: "Tab Organizer - User Data (#{date}).json"
        })
      }),

      @options.horizontal_space("10px"),

      @options.button("Import", function () {
        // TODO maybe use each.par ...?
        @openFilePicker({ type: "application/json,.json", multiple: true }) ..@each(function (s) {
                                           // TODO
          @connection.command("db.import", JSON.parse(s))
        })

        // TODO make this into a non-blocking dialog ?
        alert("Success!")
      }),

      @options.horizontal_space("20px"),

      @options.button("Reset options to default", function () {
        // TODO display a dialog that lets the user choose which things to reset
        if (confirm("Are you sure?\n\nThis will reset all options to default.\n\nThis cannot be undone.\n\nThis does NOT reset tabs, windows, or macros.")) {
          @top_options.opt.reset()
          @top_options.cache.reset()
        }
      })
    ]) ..@horizontal
  ])
}
