@ = require([
  { id: "./server/storage", name: "storage" },
  { id: "./server/window" },
  { id: "./server/url", name: "url" },
  { id: "./server/connection", name: "connection" },
  { id: "./server/manifest", name: "manifest" },
  { id: "./server/button", name: "button" }
])

exports.storage = @storage
exports.window = @window
exports.tab = @tab
exports.popup = @popup
exports.url = @url
exports.connection = @connection
exports.manifest = @manifest
exports.button = @button
