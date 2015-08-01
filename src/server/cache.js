import { uuid_port_cache } from "../common/uuid";
import { make_options } from "./options-helper";


export const init = make_options(uuid_port_cache, {
  "popup.scroll"             : 0,
  "search.last"              : "",

  "counter.session"          : null,

  "screen.available.checked" : false,
  "screen.available.left"    : 0,
  "screen.available.top"     : 0,
  "screen.available.width"   : screen["width"], // TODO ew
  "screen.available.height"  : screen["height"] // TODO ew
});
