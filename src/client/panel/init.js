import { uuid_port_popup } from "../../common/uuid";
import { ports } from "../../chrome/client";


// TODO hacky
// TODO this should use a regexp or something to search, rather than hardcoding it
export const is_panel = (location["search"] !== "?options=true");

const port = ports.connect(uuid_port_popup);

if (is_panel) {
  port.send({
    "type": "open-panel"
  });
}
