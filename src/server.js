import { uuid_port_tab } from "./common/uuid";
import { on_connect } from "./server/port";

on_connect(uuid_port_tab, (port) => {
  for (let i = 0; i < 5000; ++i) {
    port.send({
      "type": "tab",
      "value": {
        "url": "foo",
        "title": "bar",
        "favicon": "qux",
        "focused": true
      },
      "index": i
    });
  }

  port.on_receive((message) => {
    console.log(message);
  });
});

console.debug("SERVER STARTED");
