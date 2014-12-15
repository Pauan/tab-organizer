@ = require([
  { id: "lib:util/observe" },
  { id: "lib:util/dom" },
  { id: "sjs:sequence" },
  { id: "sjs:object" }
])


var changes = {
  itemBorder:         "hsl(0, 50%, 60%)",
  itemBackground:     "hsl(0, 50%, 96%)",
  categoryBackground: "hsl(0, 0%, 99%)",
  button:             "hsl(211, 75%, 99%)",
  buttonHover:        "hsl(211, 100%, 92%)",
  //font:               "hsl(211, 100%, 20%)",
  fontShadow:         "hsla(211, 30%, 30%, 0.15)",
  background:         "hsl(211, 13%, 35%)"
}

function setDefault(elem, x, def) {
  if (x === def) {
    elem.classList.remove("changed")
  } else {
    elem.classList.add("changed")
  }
}

function observeDefault(elem, info, get) {
  // TODO object/has
  if ("default" in info) {
    // TODO
    var def = info["default"]

    if (get != null) {
      elem.title = "Default: #{get(def)}"
    } else {
      elem.title = "Default: #{def}"
    }

    @observe([info.observer], function (x) {
      setDefault(elem, x, def)
    })
  }
}

var style_body = @CSS(`
  height: 100%;

  overflow: auto;
  font-family: sans-serif;
  font-size: 13px; /* TODO is this a good idea...? */

  padding-top: 29px;
  padding-right: 45px;

  background-attachment: fixed;
  background-color: ${changes.background};
  background-image: linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.1) 100%);
`)

var style_table = @CSS(`
  white-space: pre-wrap;
  margin-left: auto;
  margin-right: auto;
`)

var changed_style = @CSS(`
  &.changed {
    border-color: ${changes.itemBorder};
    background-color: ${changes.itemBackground};
  }
`)


/**
 * horizontal
 */
exports.horizontal = function (input) {
  return @Div(input) ..@horizontal
}


/**
 * button
 */
var button_style = @CSS(`
  {
    height: 24px;
    /* min-height: 22px; */
    padding-top: 1px;
    padding-left: 14px;
    padding-right: 14px;
    padding-bottom: 2px;

    text-shadow: 0px 1px 0px white;
    background-color: ${changes.button};

    box-shadow: 1px 1px 4px rgba(0, 0, 0, 0.1);

    border: 1px solid;
    border-radius: 3px;
    border-color: hsl(0, 0%, 65%)  /* top */
                  hsl(0, 0%, 55%)  /* right */
                  hsl(0, 0%, 55%)  /* bottom */
                  hsl(0, 0%, 65%); /* left */

    background-image: linear-gradient(to bottom, transparent 0%,
                                                 rgba(0, 0, 0, 0.04) 20%,
                                                 rgba(0, 0, 0, 0.05) 70%,
                                                 rgba(0, 0, 0, 0.1) 100%);
  }

  &:hover {
    background-color: ${changes.buttonHover};

    /* color: hsl(215, 100%, 94%); */ /*! #e6f0ff */
  }

  &:hover:active {
    padding-bottom: 0px;

    box-shadow: none;
    border-color: gray silver silver gray;

    background-image: linear-gradient(to bottom, transparent 0%,
                                                 rgba(0, 0, 0, 0.05) 15%,
                                                 rgba(0, 0, 0, 0.06) 85%,
                                                 rgba(0, 0, 0, 0.1) 100%);
  }
`)

exports.button = function (text, onclick) {
  return @Button(text) ..button_style ..@Mechanism(function (elem) {
    // TODO ignore later clicks ?
    // TODO rate limit or something ?
    elem ..@event("click") ..@each(function (e) {
      if (e.button === 0) {
        onclick()
      }
    })
  })
}


/**
 * checkbox
 */
var checkbox_wrapper_style = @CSS(`
  margin-top: 1px;
  margin-bottom: 1px;
`)

var checkbox_label_style = @CSS(`
  display: inline-flex; /* TODO a bit hacky */
  padding: 1px 3px;
  border: 1px solid transparent;
  border-radius: 5px;
`)

// TODO code duplication with radio
var checkbox_style = @CSS(`
  margin-right: 3px;
`)

exports.checkbox = function (info) {
  var checkbox = @Element("input", null, { type: "checkbox" })
    ..checkbox_style
    ..@Mechanism(function (elem) {
      // TODO this shouldn't set the title
      //observeDefault(elem, info)

      waitfor {
        @observe([info.observer], function (bool) {
          elem.checked = bool
        })
      } and {
        elem ..@event("change") ..@each.track(function () {
          info.observer.set(elem.checked)
        })
      }
    })

  var label = @Label([checkbox, info.text])
    ..checkbox_label_style
    ..changed_style
    ..@horizontal
    ..@Mechanism(function (elem) {
      observeDefault(elem, info)
    })

  var wrapper = @Div(label) ..checkbox_wrapper_style
  return wrapper
}


/**
 * separator
 */
var separator_style = @CSS(`
  margin-top: 0.5em;
  margin-bottom: calc(0.5em + 2px); /* TODO a bit hacky */
`)

exports.separator = function () {
  return @Hr() ..separator_style
}


/**
 * list
 */
var list_style = @CSS(`
  height: 20px;
  box-shadow: 0px 0px 5px lightgray;
  padding-left: 1px;
  /* margin-top: -2px; */
  /* top: -2px; */
  text-shadow: 0px 1px 0px white;
  background-color: ${changes.button};

  background-image: linear-gradient(to bottom, transparent 0%,
                                               rgba(0, 0, 0, 0.04) 20%,
                                               rgba(0, 0, 0, 0.05) 70%,
                                               rgba(0, 0, 0, 0.1) 100%);

  border: 1px solid;
  border-radius: 3px;
  border-color: hsl(0, 0%, 65%)  /* Top */
                hsl(0, 0%, 55%)  /* Right */
                hsl(0, 0%, 55%)  /* Bottom */
                hsl(0, 0%, 65%); /* Left */
`)

function list_items(info, values, seq) {
  return seq ..@map(function (item) {
    // TODO object/has
    if ("group" in item) {
      // TODO object/get
      return @OptGroup(list_items(info, values, item.items), { label: item.group })

    } else if (item.separator) {
      return @OptGroup()

      // TODO replace with this when it works better
      //dom.separator(function (e) {}).move(e)

      /*dom.listGroup(function (e) {
        e.font(function (t) {
          t.size("2px")
        })
      }).move(e)

      dom.listGroup(function (e) {
        e.font(function (t) {
          t.size("1px")
        })
        e.background(function (t) {
          // TODO code duplication with "ui/menu" module
          t.color("gainsboro")
        })
      }).move(e)

      dom.listGroup(function (e) {
        e.font(function (t) {
          t.size("2px")
        })
      }).move(e)*/

    } else {
      var name  = item ..@get("name")
      var value = item ..@get("value", name)

      values[value] = name

      return @Option(name, { value: value }) ..@Mechanism(function (elem) {
        // TODO test this
        @observe([info.observer], function (v) {
          if (v === value) {
            elem.selected = true
          }
        })
      })
    }
  })
}

exports.list = function (info) {
  var values = {}

  return @Element("select", list_items(info, values, info.items))
    ..list_style
    ..changed_style
    ..@Mechanism(function (elem) {
      waitfor {
        observeDefault(elem, info, function (def) {
          return values ..@get(def)
        })
      } and {
        elem ..@event("change") ..@each.track(function () {
          //var x = o.options[o.selectedIndex]
          // TODO assert that elem.value is correct ?
          info.observer.set(elem.value)
        })
      }
    })
}


/**
 * radio
 */
var radio_id = 0

// TODO code duplication with checkbox
var radio_style = @CSS(`
  margin-right: 3px;
`)

var radio_wrapper_style = @CSS(`
  display: inline-block;

  /* TODO code duplication with "checkbox" module */
  padding: 1px 3px;
  border: 1px solid transparent;
  border-radius: 5px;
`)

function radio_items(radio_name, info, values, items) {
  // TODO code duplication with list_items
  return items ..@map(function (item) {
    var name  = item ..@get("name")
    var value = item ..@get("value", name)

    values[value] = name

    var radio = @Element("input", null, {
        type: "radio",
        value: value, // TODO is this necessary ?
        name: radio_name
      })
      ..radio_style
      ..@Mechanism(function (elem) {
        waitfor {
          // TODO minor code duplication with list_items
          @observe([info.observer], function (v) {
            if (v === value) {
              elem.checked = true
            }
          })
        } and {
          elem ..@event("change") ..@each.track(function () {
            info.observer.set(value)
          })
        }
      })
    return @Label([radio, name]) ..@horizontal
  })
}

exports.radio = function (info) {
  var values = {}

  var radio_name = "__radio" + (++radio_id)

  return @Div(radio_items(radio_name, info, values, info.items))
    ..radio_wrapper_style
    ..changed_style
    ..@Mechanism(function (elem) {
      // TODO code duplication with exports.list
      observeDefault(elem, info, function (def) {
        return values ..@get(def)
      })
    })
}


/**
 * textbox
 */
var textbox_style = @CSS(`
  /* top: -1px; */
  box-shadow: 0px 0px 3px hsla(0, 0%, 0%, 0.5);

  margin-top: 2px;
  margin-bottom: 2px;
  margin-left: 3px;
  margin-right: 3px;

  border: 1px solid dimgray; /* TODO replace with hsl value */
  border-radius: 3px;

  text-align: center;
  width: 3em;
  background-color: ${changes.button}
`)

// TODO get rid of the info.type stuff ?
exports.textbox = function (info) {
  return @Element("input", null, { type: "text" })
    ..textbox_style
    ..changed_style
    ..@Mechanism(function (elem) {
      // TODO object/has
      if ("width" in info) {
        // TODO is this okay/idiomatic ?
        elem.style.width = info ..@get("width")
      }

      function setValue(x) {
        if (info.get != null) {
          x = info.get(x)
        }

                           // TODO @toString or something
        if (elem.value !== ("" + x)) {
          elem.value = x
        }
      }

      // TODO library function for this
      function isNumber(x) {
                                        // TODO test this
                                        // TODO this is hacky
        return (typeof x === "number") && !isNaN(x)
      }

      waitfor {
        observeDefault(elem, info, function (def) {
          if (info.type === "number" && !isNumber(def)) {
            throw new Error("default must be a number when type is \"number\"")
          }

          // TODO a bit hacky
          if (info.get != null) {
            return info.get(def)
          } else {
            return def
          }
        })

      } and {
        @observe([info.observer], function (x) {
          setValue(x)
        })

      } and {
        // TODO incremental ?
        elem ..@event("input") ..@each.track(function () {
          hold(500)

          var x = elem.value

          if (x === "" && info.required) {
            x = info ..@get("default") // TODO what if it doesn't have a default ?

          } else {
            //if (info.type === "number" && )
            if (info.set != null) {
              x = info.set(x)
            }

            if (info.type === "number" && !isNumber(x)) {
              x = info ..@get("default") // TODO what if it doesn't have a default ?
            }
          }

          // This is here because observers ignore duplicates, so that e.g.
          // if `info.observer.get()` is 5 and `x` is 5, we still want to update
          // the textbox with the correct value from `info.get`
          setValue(x)

          info.observer.set(x)
        })
      }
    })
}


/**
 * header
 */
var header_style = @CSS(`
  font-weight: bold;
  margin-bottom: 6px;
`)

exports.header = function (name) {
  return @Div(name) ..header_style
}


/**
 * indent
 */
var indent_style = @CSS(`
  margin-left: 12px;
`)

exports.indent = function (input) {
  return @Div(input) ..indent_style
}


/**
 * vertical_space
 * horizontal_space
 */
exports.vertical_space = function (height) {
  return @Div() ..@Style("height: #{height}")
}

exports.horizontal_space = function (width) {
  return @Div() ..@Style("width: #{width}")
}


/**
 * category
 */
var category_style = @CSS(`
  /*border: 1px outset hsla(0, 0%, 15%, 1);*/
  border-radius: 5px;

  background-color: ${changes.categoryBackground};

  padding: 10px;
  padding-top: 6px;

  box-shadow: 0px 0px  3px 1px hsla(0, 0%, 0%, 0.5),
              1px 1px 10px 2px hsla(0, 0%, 0%, 0.5);

  /* width: 100%; */ /* TODO is this needed? */

  margin-bottom: 30px;
`)

var category_header_style = @CSS(`
  font-weight: bold;
  font-size: 18px;
  color: hsla(0, 0%, 0%, 0.8);
  /*letter-spacing: 1px;*/
  /*font-variant: small-caps;*/
  text-shadow: 1px 1px 2px ${changes.fontShadow};
`)

var category_separator_style = @CSS(`
  margin-top: 0.1em;
`)

var category_content_style = @CSS(`
  padding: 0px 10px;
`)

exports.category = function (name, input) {
  var header    = @H1(name) ..category_header_style
  var separator = exports.separator() ..category_separator_style
  var content   = @Div(input) ..category_content_style
  var category  = @Div([header, separator, content]) ..category_style
  return @Tr(@Td(category))
}


/**
 * top
 */
exports.top = function (elem, input) {
  var table = @Table(@TBody(input)) ..style_table
  var top   = @Div(table) ..style_body
  elem ..@appendContent(top)
}
