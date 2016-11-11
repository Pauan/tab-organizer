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


function setChildren(state, e, children) {
  var length = children.length;

  for (var i = 0; i < length; ++i) {
    e.appendChild(children[i](state));
  }
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


exports.appendChildArray = function (unit) {
  return function (state, e, children) {
    setChildren(state, e, children);
    return unit;
  };
};


exports.appendChildView = function (observe) {
  return function (unit) {
    return function (state, e, children) {
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
    };
  };
};


exports.makeTextString = function (state, text) {
  return document.createTextNode(text);
};


exports.makeTextView = function (observe) {
  return function (unit) {
    return function (state, text) {
      var e = document.createTextNode("");

      // TODO guarantee that this is called synchronously ?
      stateObserve(state, observe, text, function (value) {
        // http://jsperf.com/textnode-performance
        e.data = value;
        return unit;
      });

      return e;
    };
  };
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


exports.unsafeSetPropertyValue = function (state, element, key, value) {
  element[key] = value;
};


exports.unsafeSetPropertyView = function (observe) {
  return function (unit) {
    return function (state, element, key, value) {
      stateObserve(state, observe, value, function (value) {
        element[key] = value;
        return unit;
      });
    };
  };
};


exports.unsafePropertyImpl = function (setProperty) {
  return function (key) {
    return function (value) {
      return function (state, element) {
        return setProperty(state, element, key, value);
      };
    };
  };
};


exports.unsafeSetStyleValue = function (state, element, key, value) {
  setStyle(element.style, key, value);
};


exports.unsafeSetStyleView = function (observe) {
  return function (unit) {
    return function (state, element, key, value) {
      stateObserve(state, observe, value, function (value) {
        setStyle(element.style, key, value);
        return unit;
      });
    };
  };
};
