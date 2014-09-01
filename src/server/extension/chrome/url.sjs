exports.newTab = "chrome://newtab/"

exports.get = function (s) {
  return chrome.runtime.getURL(s)
}
