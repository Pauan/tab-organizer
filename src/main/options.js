goog.require("optionMaker")


goog.provide("cache")

optionMaker.make(cache, "options.cache", "cache", {
  "popup.scroll"             : 0,
  "search.last"              : "",

  "screen.available.checked" : false,
  "screen.available.left"    : 0,
  "screen.available.top"     : 0,
  "screen.available.width"   : screen["width"],
  "screen.available.height"  : screen["height"]
})


goog.provide("opt")

optionMaker.make(opt, "options.user", "options", {
  "size.sidebar"          : 300,
  "size.sidebar.position" : "left",

  "size.popup.left"       : 0.5,
  "size.popup.top"        : 0.5,
  "size.popup.width"      : 920,
  "size.popup.height"     : 496,

  "size.bubble.width"     : 300,
  "size.bubble.height"    : 600,

  "popup.type"            : "sidebar",

  "popup.hotkey.ctrl"     : true,
  "popup.hotkey.shift"    : true,
  "popup.hotkey.alt"      : false,
  "popup.hotkey.letter"   : "E",

  "popup.close.escape"    : false,
  "popup.switch.action"   : "minimize",
  "popup.close.when"      : "switch-tab", // "manual",

  "group.sort.type"       : "window",
  "groups.layout"         : "vertical",

  "tabs.close.location"   : "right",
  "tabs.close.display"    : "hover",
  "tabs.close.duplicates" : false,
  "tabs.click.type"       : "focus",

  "theme.animation"       : true,
  "theme.color"           : "blue",

  "usage-tracking"        : true
})
