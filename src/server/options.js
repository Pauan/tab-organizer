import * as record from "../util/record";
import { uuid_port_options } from "../common/uuid";
import { make_options } from "./options-helper";


export const init = make_options(uuid_port_options, record.make({
  "counter.session"           : null,
  "counter.display.loaded"    : true,
  "counter.display.unloaded"  : true,

  "size.sidebar"              : 300,
  "size.sidebar.position"     : "left",

  "size.popup.left"           : 0.5,
  "size.popup.top"            : 0.5,
  "size.popup.width"          : 920,
  "size.popup.height"         : 496,

  "size.bubble.width"         : 300,
  "size.bubble.height"        : 600,

  "size.panel.width"          : 300,
  "size.panel.height"         : 600,

  "popup.type"                : "bubble",

  "popup.close.escape"        : false,
  "popup.switch.action"       : "minimize",
  "popup.close.when"          : "switch-tab", // "manual",

  "group.sort.type"           : "window",
  "groups.layout"             : "vertical",
  "groups.layout.grid.column" : 3,
  "groups.layout.grid.row"    : 2,

  "tabs.close.location"       : "right",
  "tabs.close.display"        : "hover",
  "tabs.click.type"           : "focus",
  "tabs.duplicates.behavior"  : "close-merge-old-tab",

  "theme.animation"           : true,
  "theme.color"               : "blue",

  "screen.available.checked"  : false,
  "screen.available.left"     : 0,
  "screen.available.top"      : 0,
  "screen.available.width"    : record.get(screen, "width"), // TODO ew
  "screen.available.height"   : record.get(screen, "height"), // TODO ew
}));
