@ = require([
  { id: "sjs:assert", name: "assert" },
  { id: "mho:surface", name: "surface" },
  { id: "mho:surface/html", name: "html" },
  { id: "sjs:object" },
  { id: "sjs:sequence" }
])

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

exports.textStroke = function (color, blur) {
  return ["-1px -1px " + blur + " " + color,
          "-1px  1px " + blur + " " + color,
          " 1px -1px " + blur + " " + color,
          " 1px  1px " + blur + " " + color].join(",")
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
