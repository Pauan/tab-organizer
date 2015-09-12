import * as record from "../../util/record";
import { uuid_port_popup } from "../../common/uuid";
import { ports } from "../../chrome/client";


// TODO hacky
// TODO this should use a regexp or something to search, rather than hardcoding it
export const is_panel = (record.get(location, "search") !== "?options=true");

const port = ports.open(uuid_port_popup);

if (is_panel) {
  ports.send(port, record.make({
    "type": "open-panel"
  }));
}
