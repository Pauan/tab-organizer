import { uuid_port_tab } from "./common/uuid";
import { onConnect } from "./server/port";

onConnect(uuid_port_tab, (port) => {
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

  port.onReceive((message) => {
    console.log(message);
  });
});

console.debug("SERVER STARTED");
