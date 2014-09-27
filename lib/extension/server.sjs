@ = require([
  { id: "./chrome/server/db", name: "db" },
  { id: "./chrome/server/tabs" },
  { id: "./chrome/server/url", name: "url" },
  { id: "./chrome/server/connection", name: "connection" },
  { id: "./chrome/server/manifest", name: "manifest" },
  { id: "./chrome/server/button", name: "button" }
])

exports.db = @db
exports.windows = @windows
exports.tabs = @tabs
exports.popup = @popup
exports.url = @url
exports.connection = @connection
exports.manifest = @manifest
exports.button = @button
