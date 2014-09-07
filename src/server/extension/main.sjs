@ = require([
  { id: "./chrome/db", name: "db" },
  { id: "./chrome/tabs" },
  { id: "./chrome/url", name: "url" },
  { id: "./chrome/connection", name: "connection" },
  { id: "./chrome/manifest", name: "manifest" }
])

exports.db = @db
exports.windows = @windows
exports.tabs = @tabs
exports.url = @url
exports.connection = @connection
exports.manifest = @manifest