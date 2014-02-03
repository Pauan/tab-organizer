goog.provide("platform.util")

goog.scope(function () {
  /**
   * @param {string} s
   * @return {string}
   */
  platform.util.getURL = function (s) {
    return chrome["runtime"]["getURL"](s)
  }
})
