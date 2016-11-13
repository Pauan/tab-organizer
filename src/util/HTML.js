"use strict";


exports.onImpl = function (name) {
  return function (f) {
    return function (state, element) {
      // TODO should this use true or false ?
      element.addEventListener(name, function (e) {
        f(e)();
      }, true);
    };
  };
};


exports.widget = function (f) {
  return function (state) {
    return f(state)()(state);
  };
};


function setTraits(state, e, attrs) {
  var length = attrs.length;

  for (var i = 0; i < length; ++i) {
    attrs[i](state, e);
  }
}

exports.htmlImpl = function (appendChild) {
  return function (tag) {
    return function (attrs) {
      return function (children) {
        return function (state) {
          // TODO use createElementNS ?
          var e = document.createElement(tag);

          // This must be before `setTraits`, because otherwise setting the `value` of a `<select>` doesn't work
          appendChild(state, e, children);
          setTraits(state, e, attrs);

          return e;
        };
      };
    };
  };
};


exports.textImpl = function (makeText) {
  return function (text) {
    return function (state) {
      return makeText(state, text);
    };
  };
};


exports.styleImpl = function (setStyle) {
  return function (key) {
    return function (value) {
      return function (state, element) {
        return setStyle(state, element, key, value);
      };
    };
  };
};


exports.body = function () {
  return document.body;
};


exports.trait = function (traits) {
  return function (state, element) {
    setTraits(state, element, traits);
  };
};


exports.onDragImpl = function (makeEvent) {
  return function (onStart) {
    return function (onMove) {
      return function (onEnd) {
        return function (state, element) {
          var initialX = null;
          var initialY = null;
          var dragging = false; // TODO is this correct ?

          function mousemove(e) {
            if (dragging) {
              var x = e.clientX;
              var y = e.clientY;
              onMove(makeEvent(x)(y)(x - initialX)(y - initialY))();
            }
          }

          function mouseup(e) {
            if (dragging) {
              var x = e.clientX;
              var y = e.clientY;

              var oldX = x - initialX;
              var oldY = y - initialY;

              initialX = null;
              initialY = null;
              dragging = false;

              removeEventListener("mousemove", mousemove, true);
              removeEventListener("mouseup", mouseup, true);

              onEnd(makeEvent(x)(y)(oldX)(oldY))();
            }
          }

          element.addEventListener("mousedown", function (e) {
            if (!dragging) {
              addEventListener("mousemove", mousemove, true);
              // TODO what about `blur` or other events ?
              addEventListener("mouseup", mouseup, true);

              var x = e.clientX;
              var y = e.clientY;

              initialX = x;
              initialY = y;
              dragging = true;

              onStart(makeEvent(x)(y)(x - initialX)(y - initialY))();
            }
          }, true);
        };
      };
    };
  };
};
