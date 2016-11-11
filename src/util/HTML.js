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


function setAttributes(state, e, attrs) {
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

          // This must be before `setAttributes`, because otherwise setting the `value` of a `<select>` doesn't work
          appendChild(state, e, children);
          setAttributes(state, e, attrs);

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
