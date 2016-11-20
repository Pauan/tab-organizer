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
  return function (important) {
    return function (key) {
      return function (value) {
        return function (state, element) {
          return setStyle(state, element, key, value, important);
        };
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


// TODO test this
exports.onDragImpl = function (makeEvent) {
  return function (makePosition) {
    function getEvent(element, initialX, initialY, e) {
      var x = e.clientX;
      var y = e.clientY;
      var box = element.getBoundingClientRect();
      var position = makePosition(box.left)(box.top)(box.width)(box.height);
      return makeEvent(initialX)(initialY)(x)(y)(position);
    }

    return function (threshold) {
      return function (onStart) {
        return function (onMove) {
          return function (onEnd) {
            return function (state, element) {
              var initialX = null;
              var initialY = null;
              var dragging = false;

              function mousemove(e) {
                var event = getEvent(element, initialX, initialY, e);

                if (dragging) {
                  onMove(event)();

                } else if (threshold(event)()) {
                  dragging = true;
                  onStart(event)();
                }
              }

              function mouseup(e) {
                // TODO don't create this if dragging is false ?
                var event = getEvent(element, initialX, initialY, e);

                initialX = null;
                initialY = null;

                removeEventListener("mousemove", mousemove, true);
                removeEventListener("mouseup", mouseup, true);

                if (dragging) {
                  dragging = false;

                  onEnd(event)();
                }
              }

              element.addEventListener("mousedown", function (e) {
                initialX = e.clientX;
                initialY = e.clientY;

                addEventListener("mousemove", mousemove, true);
                // TODO what about `blur` or other events ?
                addEventListener("mouseup", mouseup, true);

                var event = getEvent(element, initialX, initialY, e);

                dragging = threshold(event)();

                if (dragging) {
                  onStart(event)();
                }
              }, true);
            };
          };
        };
      };
    };
  };
};
