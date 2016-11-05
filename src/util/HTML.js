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

function attributeObserve(observe, unit, view, f) {
  return function (state, element) {
    var resource = observe(function (value) {
      // TODO make this more efficient ?
      return function () {
        f(state, element, value);
        return unit;
      };
    })(view)();

    // TODO test this
    beforeRemove(state, resource);
  };
}

function makePropertyViewSetter(f) {
  return function (observe) {
    return function (unit) {
      return function (view) {
        return attributeObserve(observe, unit, view, f);
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


// TODO test this
// TODO browser prefixes
function setStyle(style, key, value) {
  var oldValue = style.getPropertyValue(key);

  style.setProperty(key, value, "");

  var newValue = style.getPropertyValue(key);

  // TODO this is probably incorrect
  if (oldValue === newValue) {
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
        return attributeObserve(observe, unit, view, function (state, element, value) {
          setStyle(element.style, key, value);
        });
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


exports.html = function (tag) {
  return function (attrs) {
    return function (children) {
      return function (state) {
        // TODO use createElementNS ?
        var e = document.createElement(tag);

        var length1 = children.length;

        // This must be before the attributes, because otherwise setting the `value` of a `<select>` doesn't work
        for (var i1 = 0; i1 < length1; ++i1) {
          e.appendChild(children[i1](state));
        }

        var length2 = attrs.length;

        for (var i2 = 0; i2 < length2; ++i2) {
          attrs[i2](state, e);
        }

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
