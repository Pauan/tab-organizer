@ = require([
  { id: "./chrome/db", name: "db" },
  { id: "./chrome/tabs/main" },
  { id: "./chrome/url", name: "url" }
])

exports.db = @db
exports.windows = @windows
exports.tabs = @tabs
exports.url = @url
