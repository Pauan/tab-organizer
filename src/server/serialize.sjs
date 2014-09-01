@ = require([
  { id: "sjs:object" },
  { id: "sjs:sequence" },
  { id: "sjs:assert", name: "assert" }
])

// TODO standard library function
function notNull(x, s) {
  @assert.isNot(x, null, s)
  @assert.isNot(x, undefined, s)
}

function set(o, x, s) {
  if (x.time[s] != null) {
    o.time[s] = x.time[s]
  }
}

function get(f, x, y) {
  if (x == null) {
    return y
  } else if (y == null) {
    return x
  } else {
    return f(x, y)
  }
}

function setMin(o, x, y, s) {
  var i = get(Math.min, x.time[s], y.time[s])
  if (i != null) {
    o.time[s] = i
  }
}

function setMax(o, x, y, s) {
  var i = get(Math.max, x.time[s], y.time[s])
  if (i != null) {
    o.time[s] = i
  }
}

function setGroups(o, x, y) {
  @assert.ok(o.groups != null, o.url)
  @assert.ok(x.groups != null, x.url)
  @assert.ok(y.groups != null, y.url)
  x.groups ..@ownPropertyPairs ..@each(function ([s, i]) {
    notNull(s)
    notNull(i)
    // TODO should this be min or max ?
    o.groups[s] = get(Math.min, i, y.groups[s])
  })
}

// Uses the title of whichever tab was created/updated most recently
function setTitle(o, x, y) {
  var iX = x.time.updated || x.time.created
    , iY = y.time.updated || y.time.created
  notNull(iX)
  notNull(iY)
  @assert.isNot(iX, iY)
  if (iX > iY) {
    o.title = x.title
  } else {
    o.title = y.title
  }
}

exports.one = function (x) {
  notNull(x.groups, x.url)
  notNull(x.time.created)

  var o = {
    id: x.id,
    time: {
      created: x.time.created
    },
    groups: x.groups,
    title: x.title
  }
  set(o, x, "updated")
  set(o, x, "focused")
  set(o, x, "unloaded")
  set(o, x, "session")
  return o
}

// Merge two tabs together into a serializable format
exports.merge = function (x, y) {
  @assert.isNot(x, y)

  // TODO
  //@assert.ok(x.url === y.url, "#{x.url} : #{y.url}")

  notNull(x.time.created)
  notNull(y.time.created)

  var o = {
    time: {},
    groups: {}
  }

  setTitle(o, x, y)

  setGroups(o, x, y)
  setGroups(o, y, x)

  setMin(o, x, y, "created")

  setMax(o, x, y, "updated")
  setMax(o, x, y, "focused")
  setMax(o, x, y, "unloaded") // TODO should this be min or max ?
  setMax(o, x, y, "session")

  /*if (x.pinned || y.pinned) {
    o.pinned = 1
  }*/

  return o
}
