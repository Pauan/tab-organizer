import { uuid_port_options } from "../common/uuid";
import { make_options } from "./options-helper";


export const init = make_options(uuid_port_options, {
  "counter.enabled"           : true,
  "counter.type"              : "in-chrome",

  "size.sidebar"              : 300,
  "size.sidebar.position"     : "left",

  "size.popup.left"           : 0.5,
  "size.popup.top"            : 0.5,
  "size.popup.width"          : 920,
  "size.popup.height"         : 496,

  "size.bubble.width"         : 300,
  "size.bubble.height"        : 600,

  "popup.type"                : "bubble",

  "popup.hotkey.ctrl"         : true,
  "popup.hotkey.shift"        : true,
  "popup.hotkey.alt"          : false,
  "popup.hotkey.letter"       : "E",

  "popup.close.escape"        : false,
  "popup.switch.action"       : "minimize",
  "popup.close.when"          : "switch-tab", // "manual",

  "group.sort.type"           : "group",
  "groups.layout"             : "vertical",
  "groups.layout.grid.column" : 3,
  "groups.layout.grid.row"    : 2,

  "tabs.close.location"       : "right",
  "tabs.close.display"        : "hover",
  "tabs.close.duplicates"     : false,
  "tabs.click.type"           : "focus",

  "theme.animation"           : true,
  "theme.color"               : "blue",

  "usage-tracking"            : true
});
