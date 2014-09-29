@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "mho:surface", name: "surface" },
  { id: "mho:surface/html", name: "html" },
  { id: "sjs:object" },
  { id: "sjs:sequence" },
  { id: "./event" },
  { id: "./util" }
])

var highestZIndex = "2147483647" /* 32-bit signed int */

// TODO is this a good idea/idiomatic ?
exports ..@extend(@surface)
exports ..@extend(@html)

exports.horizontal = @surface.CSS(`
  display: flex;
  flex-direction: row;
  align-items: center;
`)

exports.stretch = @surface.CSS(`
  flex-shrink: 1;
  flex-grow: 1;
  flex-basis: 0%;
`)

exports.panel = @surface.CSS(`
  position: absolute;
  z-index: ${highestZIndex};
`)

exports.clip = @surface.CSS(`
  flex-shrink: 1;
  overflow: hidden;
  text-overflow: ellipsis;
`)

exports.text_stroke = function (color, blur) {
  return ["-1px -1px " + blur + " " + color,
          "-1px  1px " + blur + " " + color,
          " 1px -1px " + blur + " " + color,
          " 1px  1px " + blur + " " + color].join(",")
}

/*exports.scrollTo = function (elem) {
  var top = elem
  var y = elem.offsetTop
  while ((top = top.offsetParent)) {
    y += top.offsetTop
  }
  console.log(document.body.scrollTop, elem.getBoundingClientRect(), y)
  document.body.scrollTop = y + 500
}*/

exports.observe_array = function (dom, obs, info) {
  if (info == null) {
    info = {}
  }

  var nodes = []

  return dom ..@surface.Mechanism(function (elem) {
    function add(event, index) {
      var a = (index < nodes.length
                ? nodes ..@get(index) ..@surface.insertBefore(event.after)
                : elem ..@surface.appendContent(event.after))

      @assert.is(a.length, 1)

      return a[0]
    }

    function init(event) {
      if (info.map) {
        event.after = info.map(event.after)
      }

      nodes ..@spliceNew(event.index, add(event, event.index))
    }

    function change(event) {
      if (event.type === "add") {
        if (info.map) {
          event.after = info.map(event.after)
        }

        if (info.animate_add) {
          event.after = event.after ..@surface.Mechanism(function (elem) {
            // TODO should this be true ?
            elem.scrollIntoViewIfNeeded(true)
            info.animate_add(elem)
          })
        } else {
          event.after = event.after ..@surface.Mechanism(function (elem) {
            // TODO should this be true ?
            elem.scrollIntoViewIfNeeded(true)
          })
        }

        nodes ..@spliceNew(event.index, add(event, event.index))

      } else if (event.type === "modify") {
        if (info.map) {
          event.after = info.map(event.after)
        }

        if (info.animate_modify) {
          event.after = event.after ..@surface.Mechanism(function (elem) {
            info.animate_modify(elem)
          })
        }

        var node = nodes ..@get(event.index)
        node ..@surface.removeNode()
        nodes ..@set(event.index, add(event, event.index + 1))

      } else if (event.type === "remove") {
        var node = nodes ..@get(event.index)
        nodes ..@remove(node)
        return node

      } else {
        @assert.fail()
      }
    }

    obs.current ..@each(init)
    obs.changes ..@transform(change) ..@each.par(function (node) {
      if (node) {
        if (info.animate_remove) {
          info.animate_remove(node)
        }

        node ..@surface.removeNode()
      }
    })
  })
}

exports.event = function (elem, name, info) {
  var o = @Emitter()
  elem.addEventListener(name, function (e) {
    if (info != null) {
      if (info.preventDefault) {
        e.preventDefault()
      }
    }
    o ..@emit(e)
  }, true)
  return o
}

exports.saveFilePicker = function (data, info) {
  // TODO what if info.type is not provided ?
  var s = new Blob([data], { type: info.type })
  // "data:application/json," + encodeURIComponent(s)
  var url = URL.createObjectURL(s)

  try {
    var a = document.createElement("a")
    a.href = url
    a.download = info.name
    a.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}

function readFile(file) {
  var x = new FileReader()

  waitfor (var err, result) {
    // TODO test this
    x.onerror = function (e) {
      console.log("ERROR2", e, x.error)
      resume(e)
    }

    x.onabort = function (e) {
      console.log("ABORT", e, x.error)
      resume(e)
    }

    x.onload = function (e) {
      resume(null, e.target.result)
    }

    x.readAsText(file)
  // TODO
  } retract {
    throw new Error("util.dom: cannot retract when reading file")
  }

  if (err) {
    throw err
  } else {
    return result
  }
}

exports.openFilePicker = function (info) {
  var file = document.createElement("input")
  file.type = "file"
  file.accept = info.type // TODO what if the user doesn't pass in a type property ?
  file.multiple = info.multiple // TODO what if the user doesn't pass in a multiple property ?

  waitfor (var err, result) {
    file.addEventListener("blur", function (e) {
      console.log("BLUR", e)
    }, true)

    file.addEventListener("focus", function (e) {
      console.log("FOCUS", e)
    }, true)

    file.addEventListener("invalid", function (e) {
      console.log("INVALID", e)
    }, true)

    file.addEventListener("reset", function (e) {
      console.log("RESET", e)
    }, true)

    file.addEventListener("load", function (e) {
      console.log("LOAD", e)
    }, true)


    file.addEventListener("cancel", function (e) {
      console.log("CANCEL", e)
      resume(e)
    }, true)

    file.addEventListener("abort", function (e) {
      console.log("ABORT", e)
      resume(e)
    }, true)

    // TODO test this
    file.addEventListener("error", function (e) {
      console.log("ERROR", e)
      resume(e)
    }, true)


    file.addEventListener("input", function (e) {
      console.log("INPUT", e, file.files)
    }, true)

    file.addEventListener("change", function (e) {
      resume(null, e.target.files)
    }, true)

    file.click()
  } retract {
    throw new Error("util.dom: cannot retract when opening file")
  }

  if (err) {
    throw err
  } else {
    @assert.is(file.files, result)

    // TODO what if info.multiple is false ?
    // TODO should this be map.par ...?
    return result ..@map.par(function (x) {
      return readFile(x)
    })
  }
}
