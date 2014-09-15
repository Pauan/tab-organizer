@ = require([
  { id: "mho:surface", name: "surface" },
  { id: "mho:surface/html", name: "html" },
  { id: "sjs:object" }
])

// TODO is this a good idea/idiomatic ?
exports ..@extend(@surface)
exports ..@extend(@html)

exports.horizontal = @surface.CSS(`
  display: flex;
  flex-direction: row;
  align-items: center;
`)
