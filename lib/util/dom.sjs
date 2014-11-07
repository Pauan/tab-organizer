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
//exports ..@extend(@surface)
//exports ..@extend(@html)

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


// Moar performance!!!
__js {
  var batch_write_queue = []
  var batch_read_queue  = []

  var batching = false

  function exec_async(x) {
    for (var i = 0, len = x.length; i < len; ++i) {
      x[i]()
    }
  }

  function append(elem, array) {
    for (var i = 0, len = array.length; i < len; ++i) {
      elem.appendChild(array[i])
    }
  }

  function insertBefore(elem, array, before) {
    for (var i = 0, len = array.length; i < len; ++i) {
      elem.insertBefore(array[i], before)
    }
  }

  function batch() {
    if (!batching) {
      batching = true

      requestAnimationFrame(function () {
        try {
          exec_async(batch_write_queue)
          exec_async(batch_read_queue)
        } finally {
          // TODO is it faster to do this, or assign them to [] ?
          batch_write_queue.length = 0
          batch_read_queue.length = 0
          batching = false
        }
      })
    }
  }

  function batch_write(f) {
    batch_write_queue.push(f)
    batch()
  }
}

// TODO is this too inefficient ?
function batch_read(f) {
  waitfor () {
    function done() {
      f()
      resume()
    }
    batch_read_queue ..@push(done)
    batch()
  // TODO test this
  } retract {
    batch_read_queue ..@remove(done)
  }
}


function add_stylesheet(s, f) {
  var e = document.createElement("style")
  e.type = "text/css"
  document.head.appendChild(e)

  var sheet = document.styleSheets[document.styleSheets.length - 1]
  sheet.insertRule(s + "{}", sheet.cssRules.length) //sheet.addRule(s)

  var rule = sheet.cssRules[sheet.cssRules.length - 1]
  return rule ..@get("style")
}

function style_get(style, name) {
  // TODO does this trigger a relayout/repaint ?
  var value = style.getPropertyValue(name)
  // Hack needed because Chrome doesn't follow the spec
  if (value === null) {
    value = ""
  }
  // TODO isString test
  @assert.is(typeof value, "string")
  return value
}

function style_add1(style, name, value) {
  if (value == null) {
    value = ""
  }

  // TODO isString test
  @assert.is(typeof value, "string")

  var old_value = style_get(style, name)
  // TODO isString test
  @assert.is(old_value, "", name)
  if (value === old_value) {
    throw new Error("#{name}: #{value}")
  }
  // TODO why doesn't this work?!
  //@assert.isNot(value, old_value, name)

  // http://dev.w3.org/csswg/cssom/#dom-cssstyledeclaration-setproperty
  style.setProperty(name, value, "")

  var new_value = style_get(style, name) // TODO does this trigger a relayout/repaint ?
  if (new_value === old_value) {
    throw new Error("#{name}: #{value}")
  }
  // TODO why doesn't this work?!
  //@assert.isNot(new_value, old_value, name)
}

function style_add(style, info) {
  info ..@items ..@each(function ([key, value]) {
    style_add1(style, key, value)
  })
}


var class_counter = 0

// TODO should delay appending this into the DOM until it's actually used
exports.Class = function (info) {
  return {
    class_name: "__class_counter_#{++class_counter}__",
    class_props: info,
    class_loaded: false
  }
}

// Only load a class into the DOM the first time it's actually used
function load_class(x) {
  if (!(x ..@get("class_loaded"))) {
    var class_name  = x ..@get("class_name")

    batch_write(function () {
      var class_style = add_stylesheet(".#{class_name}")

      //x ..@setNew("class_style", class_style)

      style_add(class_style, x ..@get("class_props"))
    })

    x ..@set("class_loaded", true)
  }
  return x ..@get("class_name")
}


// TODO
exports.horizontal = exports.Class({
  "display": "flex",
  "flex-direction": "row",
  "align-items": "center"
})

// TODO
exports.stretch = exports.Class({
  "flex-shrink": "1",
  "flex-grow": "1",
  "flex-basis": "0%"
})

// TODO
exports.panel = exports.Class({
  "position": "absolute",
  "z-index": highestZIndex
})

// TODO
exports.clip = exports.Class({
  "flex-shrink": "1",
  "overflow": "hidden",
  "text-overflow": "ellipsis"
})


function process_append1(x) {
  if (typeof x === "string") {
    return document.createTextNode(x)
  } else {
    exec_async(x.onAppend)
    return exports.dom(x)
  }
}

function process_append(x) {
  if (Array.isArray(x)) {
    var a = []
    x ..@each(function (x) {
      if (x != null) {
        a ..@push(process_append1(x))
      }
    })
    return a
  } else if (x == null) {
    return []
  } else {
    return [process_append1(x)]
  }
}

function class_add(elem, name) {
  // TODO does this cause a reflow/relayout ?
  @assert.is(elem.classList.contains(name), false)
  elem.classList.add(name)
}

function attr_add(elem, name, value) {
  // TODO does this cause a reflow/relayout ?
  @assert.is(elem.hasAttribute(name), false)
  elem.setAttribute(name, value)
}

function attrs_add(wrapper, elem, info) {
  info ..@items ..@each(function ([key, value]) {
    if (key === "class") {
      class_add(elem, load_class(value))
    } else if (key === "style") {
      style_add(elem ..@get("style"), value)
    } else if (key === "animate") {
      wrapper.animate ..@pushNew(value)
    } else {
      attr_add(elem, key, value)
    }
  })
}

function wrap(elem) {
  return {
    element: elem,
    onAppend: [],
    onRemove: [],
    animate: []
  }
}

function animate_start(dom) {
  // TODO
  spawn dom.animate ..@each.par(function (x) {
    x.animate_start(dom)
  })
}

function animate_end(dom) {
  dom.animate ..@each.par(function (x) {
    x.animate_end(dom)
  })
}


exports.dom = function (dom) {
  return dom ..@get("element")
}

exports.style_add = function (dom, info) {
  var elem = exports.dom(dom)
  var style = elem ..@get("style")
  batch_write(function () {
    // TODO this can probably do some work ahead of time, before the actual batch
    style_add(style, info)
  })
}

exports.class_add = function (dom, value) {
  var elem = exports.dom(dom)
  var name = load_class(value)
  batch_write(function () {
    class_add(elem, name)
  })
}

exports.attr_add = function (dom, name, value) {
  var elem = exports.dom(dom)
  batch_write(function () {
    attr_add(elem, name, value)
  })
}

exports.initialize = function (parent, dom) {
  var elem = exports.dom(parent)
  var array = process_append(dom)
  batch_write(function () {
    append(elem, array)
  })
}

exports.appendNode = function (parent, dom) {
  var elem = exports.dom(parent)
  var array = process_append(dom)
  batch_write(function () {
    append(elem, array)
  })
  animate_start(dom)
}

exports.insertBefore = function (parent, dom, before1) {
  var elem = exports.dom(parent)
  var array = process_append(dom)
  var before2 = exports.dom(before1)
  batch_write(function () {
    insertBefore(elem, array, before2)
  })
  animate_start(dom)
}

exports.replaceNode = function (before1, dom) {
  var before2 = exports.dom(before1)
  var elem = exports.dom(dom)
  @assert.ok(before2.parentNode != null)
  batch_write(function () {
    @assert.ok(before2.parentNode != null)
    before2.parentNode.replaceChild(elem, before2)
  })
}

// TODO test this
exports.removeNode = function (dom) {
  var elem = exports.dom(dom)

  @assert.ok(elem.parentNode != null)

  batch_write(function () {
    @assert.ok(elem.parentNode != null)

    animate_end(dom)

    @assert.ok(elem.parentNode != null)
    elem.parentNode.removeChild(elem)
  })

  // TODO this might execute before or after the element is removed: should we provide some guarantees?
  try {
    exec_async(dom.onRemove)
  } finally {
    // TODO is this faster than setting it to [] ?
    dom.onRemove.length = 0
  }
}

exports.Element = function (name, attrs, body) {
  var elem = document.createElement(name)
  var wrapper = wrap(elem)

  if (attrs != null) {
    attrs_add(wrapper, elem, attrs)
  }

  append(elem, process_append(body))

  return wrapper
}

exports.Mechanism = function (elem, f) {
  elem.onAppend ..@push(function () {
    waitfor {
      f(elem)
    } or {
      waitfor () {
        var done = resume
        elem.onRemove ..@push(done)
      } retract {
        elem.onRemove ..@remove(done)
      }
    }
  })
  return elem
}

exports.Div = function (attrs, body) {
  return exports.Element("div", attrs, body)
}

exports.Body = wrap(document.body)


exports.observe_array = function (dom, obs, info) {
  if (info == null) {
    info = {}
  }

  var nodes = []

  return dom ..exports.Mechanism(function (elem) {
    function add(dom, index) {
          // TODO @nth_has
      if (index < nodes.length) {
                                                 // TODO nth
        elem ..exports.insertBefore(dom, nodes ..@get(index))
      } else {
        elem ..exports.appendNode(dom)
      }
    }

    function init(x) {
      if (info.map) {
        x = info.map(x)
      }

      nodes ..@push(x)
      elem ..exports.initialize(x)
      //elem ..exports.appendNode(x)
    }

    function change(event) {
      if (event.type === "add") {
        if (info.map) {
          event.after = info.map(event.after)
        }

        nodes ..@spliceNew(event.index, event.after)
        add(event.after, event.index + 1)

      } else if (event.type === "modify") {
        if (info.map) {
          event.after = info.map(event.after)
        }

        var before = nodes ..@get(event.index)
        // TODO nth_modify
        nodes ..@set(event.index, event.after)

        before ..exports.replaceWith(event.after)

      } else if (event.type === "remove") {
        var elem = nodes ..@get(event.index)
        // TODO nth_remove
        nodes ..@remove(elem)

        elem ..exports.removeNode()

      } else {
        @assert.fail()
      }
    }

    obs.current ..@each(init)
    // TODO shouldn't rely on each.par behaving reliably for synchronous values
    obs.changes ..@each.par(change)
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
