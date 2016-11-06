"use strict";


function makeState(parent) {
  // TODO is it faster to lazily initialize the arrays only when needed ?
  return {
    parent: parent,
    afterInsert: [],
    beforeRemove: []
  };
}

// TODO don't allow for calling this after the element has been inserted ?
function beforeRemove(state, f) {
  state.beforeRemove.push(f);
}

// TODO test this
function afterInsert(state, f) {
  // TODO is this correct ?
  if (state.afterInsert === null) {
    throw new Error("Element is already inserted");
  }

  for (;;) {
    // TODO what if the parent is killed ?
    if (state.parent === null || state.parent.afterInsert === null) {
      state.afterInsert.push(f);
      return;

    } else {
      state = state.parent;
    }
  }
}

function triggerInsert(state) {
  var a = state.afterInsert;

  // TODO is this correct ?
  state.parent = null;
  state.afterInsert = null;

  var length = a.length;

  for (var i = 0; i < length; ++i) {
    a[i]();
  }
}

function triggerRemove(state) {
  // TODO is this correct ?
  if (state.afterInsert !== null) {
    throw new Error("Killed before the element was inserted");
  }

  var a = state.beforeRemove;

  state.beforeRemove = null;

  var length = a.length;

  for (var i = 0; i < length; ++i) {
    a[i]();
  }
}


function makePropertySetter(f) {
  return function (value) {
    return function (state, element) {
      f(state, element, value);
    };
  };
}

function stateObserve(state, observe, view, f) {
  var resource = observe(function (value) {
    // TODO make this more efficient ?
    return function () {
      return f(value);
    };
  })(view)();

  // TODO test this
  beforeRemove(state, resource);
}

function makePropertyViewSetter(f) {
  return function (observe) {
    return function (unit) {
      return function (view) {
        return function (state, element) {
          stateObserve(state, observe, view, function (value) {
            f(state, element, value);
            return unit;
          });
        };
      };
    };
  };
}


function setValue(state, element, value) {
  element.value = value;
}

exports.value = makePropertySetter(setValue);
exports.valueViewImpl = makePropertyViewSetter(setValue);


function setChecked(state, element, value) {
  element.checked = value;
}

exports.checked = makePropertySetter(setChecked);
exports.checkedViewImpl = makePropertyViewSetter(setChecked);


exports.onClickImpl = function (f) {
  return function (state, element) {
    element.addEventListener("click", function (e) {
      f({})();
    }, true);
  };
};


// TODO test this
// TODO browser prefixes
function setStyle(style, key, value) {
  // TODO can this be made faster ?
  // TODO remove this ?
  if (key in style) {
    style.removeProperty(key);

    // TODO is this correct ?
    if (value !== "") {
      style.setProperty(key, value, "");

      // TODO test this
      if (style.getPropertyValue(key) === "") {
        throw new Error("Invalid style \"" + key + "\": \"" + value + "\"");
      }
    }

  } else {
    throw new Error("Invalid style \"" + key + "\": \"" + value + "\"");
  }
}

exports.style = function (key) {
  return function (value) {
    return function (state, element) {
      setStyle(element.style, key, value);
    };
  };
};

exports.styleViewImpl = function (observe) {
  return function (unit) {
    return function (key) {
      return function (view) {
        return function (state, element) {
          stateObserve(state, observe, view, function (value) {
            setStyle(element.style, key, value);
            return unit;
          });
        };
      };
    };
  };
};


exports.widget = function (f) {
  return function (state) {
    return f(state)()(state);
  };
};


exports.beforeRemoveImpl = function (unit) {
  return function (eff) {
    return function (state) {
      return function () {
        beforeRemove(state, eff);
        return unit;
      };
    };
  };
};


exports.afterInsertImpl = function (unit) {
  return function (eff) {
    return function (state) {
      return function () {
        afterInsert(state, eff);
        return unit;
      };
    };
  };
};


function setChildren(state, e, children) {
  var length = children.length;

  for (var i = 0; i < length; ++i) {
    e.appendChild(children[i](state));
  }
}

function setAttributes(state, e, attrs) {
  var length = attrs.length;

  for (var i = 0; i < length; ++i) {
    attrs[i](state, e);
  }
}

exports.html = function (tag) {
  return function (attrs) {
    return function (children) {
      return function (state) {
        // TODO use createElementNS ?
        var e = document.createElement(tag);

        // This must be before `setAttributes`, because otherwise setting the `value` of a `<select>` doesn't work
        setChildren(state, e, children);
        setAttributes(state, e, attrs);

        return e;
      };
    };
  };
};


function setChildrenView(state, e, children, observe, unit) {
  var childState = null;

  // TODO guarantee that this is called synchronously ?
  stateObserve(state, observe, children, function (value) {
    var oldState = childState;

    childState = makeState(state);

    // TODO is it faster or slower to use a document fragment ?
    var fragment = document.createDocumentFragment();

    setChildren(childState, fragment, value);

    if (oldState !== null) {
      triggerRemove(oldState);
      // TODO can this be made faster ?
      e.innerHTML = "";
    }

    e.appendChild(fragment);

    triggerInsert(childState);

    return unit;
  });

  // TODO test this
  beforeRemove(state, function () {
    triggerRemove(childState);
  });
}

exports.htmlViewImpl = function (observe) {
  return function (unit) {
    return function (tag) {
      return function (attrs) {
        return function (children) {
          return function (state) {
            // TODO use createElementNS ?
            var e = document.createElement(tag);

            // This must be before `setAttributes`, because otherwise setting the `value` of a `<select>` doesn't work
            setChildrenView(state, e, children, observe, unit);
            setAttributes(state, e, attrs);

            return e;
          };
        };
      };
    };
  };
};


exports.text = function (text) {
  return function (state) {
    // TODO cache this ?
    return document.createTextNode(text);
  };
};


exports.textViewImpl = function (observe) {
  return function (unit) {
    return function (view) {
      return function (state) {
        var e = document.createTextNode("");

        // TODO guarantee that this is called synchronously ?
        stateObserve(state, observe, view, function (value) {
          // http://jsperf.com/textnode-performance
          e.data = value;
          return unit;
        });

        return e;
      };
    };
  };
};


exports.attribute = function (key) {
  return function (value) {
    return function (state, element) {
      // TODO use setAttributeNS ?
      element.setAttribute(key, value);
    };
  };
};


exports.body = function () {
  return document.body;
};


exports.renderImpl = function (unit) {
  return function (parent) {
    return function (html) {
      return function () {
        var state = makeState(null);

        var child = html(state);

        parent.appendChild(child);

        triggerInsert(state);

        // TODO what if this is called twice ?
        return function () {
          triggerRemove(state);
          parent.removeChild(child);
          return unit;
        };
      };
    };
  };
};
