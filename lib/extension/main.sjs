@ = require([
  { id: "./chrome/db", name: "db" },
  { id: "./chrome/tabs" },
  { id: "./chrome/url", name: "url" },
  { id: "./chrome/connection", name: "connection" },
  { id: "./chrome/manifest", name: "manifest" },
  { id: "./chrome/button", name: "button" },
  { id: "./chrome/popup", name: "popup" }
])

exports.db = @db
exports.windows = @windows
exports.tabs = @tabs
exports.url = @url
exports.connection = @connection
exports.manifest = @manifest
exports.button = @button
exports.popup = @popup
