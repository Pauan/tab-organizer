@ = require([
  { id: "mho:surface" },
  { id: "mho:surface/html" },
  { id: "lib:util/observe" },
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
  font-size: 13px;

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



/**
 * checkbox
 */
var checkbox_wrapper_style = @CSS(`
  display: inline-block;
  margin-top: 1px;
  margin-bottom: 1px;
`)

var checkbox_label_style = @CSS(`
  {
    padding: 1px 3px;
    border-width: 1px;
    border-radius: 5px;
  }

  &.changed {
    border-color: ${changes.itemBorder};
    background-color: ${changes.itemBackground};
  }
`)

// TODO code duplication with radio
var checkbox_style = @CSS(`
  {
    margin-right: 3px;
  }

  /* TODO this doesn't work but should */
  /*&.changed {
    border-color: blue;
  }*/
`)

exports.checkbox = function (info) {
  var checkbox = @Element("input")
    ..@Attrib("type", "checkbox")
    ..checkbox_style
    // TODO handle retraction
    ..@Mechanism(function (elem) {
      // TODO this shouldn't set the title
      //observeDefault(elem, info)

      @observe([info.observer], function (bool) {
        elem.checked = bool
      })

      // TODO use built-ins
      elem.addEventListener("change", function () {
        info.observer.set(elem.checked)
      }, true)
    })

  var label = @Label([checkbox, info.text])
    ..checkbox_label_style
    // TODO handle retraction
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
  {
    height: 20px;
    box-shadow: 0px 0px 5px lightgray;
    padding-left: 1px;
    /* margin-top: -2px; */
    /* top: -2px; */
    border-width: 1px;
    border-radius: 3px;
    text-shadow: 0px 1px 0px white;
    background-color: ${changes.button};

    background-image: linear-gradient(to bottom, transparent 0%,
                                                 rgba(0, 0, 0, 0.04) 20%,
                                                 rgba(0, 0, 0, 0.05) 70%,
                                                 rgba(0, 0, 0, 0.1) 100%);

    border-color: hsl(0, 0%, 65%)  /* Top */
                  hsl(0, 0%, 55%)  /* Right */
                  hsl(0, 0%, 55%)  /* Bottom */
                  hsl(0, 0%, 65%); /* Left */
  }

  /* TODO code duplication */
  &.changed {
    border-color: ${changes.itemBorder};
    background-color: ${changes.itemBackground};
  }
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
          // TODO what if it doesn't have a value ?
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
    ..@Mechanism(function (elem) {
      observeDefault(elem, info, function (def) {
        return values ..@get(def)
      })

      // TODO use built-ins
      elem.addEventListener("change", function () {
        //var x = o.options[o.selectedIndex]
        // TODO assert that elem.value is correct ?
        info.observer.set(elem.value)
      }, true)
    })
}


/**
 * category
 */
var category_style = @CSS(`
  border-width: 1px;
  border-style: outset;
  border-color: hsl(0, 0%, 15%);
  border-radius: 5px;

  background-color: ${changes.categoryBackground};

  padding: 10px;
  padding-top: 5px;

  box-shadow: 1px 1px 10px 1px hsla(0, 0%, 0%, 0.5);
  /* width: 100%; */ /* TODO is this needed? */

  margin-bottom: 30px;
`)

var category_header_style = @CSS(`
  font-size: 20px;
  color: hsla(0, 0%, 0%, 0.8);
  letter-spacing: 1px;
  font-variant: small-caps;
  text-shadow: 1px 1px 2px ${changes.fontShadow};
`)

var category_separator_style = @CSS(`
  margin-top: 0px;
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

exports.top = function (input) {
  var table = @Table(@TBody(input)) ..style_table
  var top   = @Div(table) ..style_body
  return top
}
