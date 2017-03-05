"use strict";


exports.resolvePath = function (path) {
  return chrome.runtime.getURL(path);
};
