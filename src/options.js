import { uuid_port_tab } from "./common/uuid";
import { connect } from "./client/port";

const port = connect(uuid_port_tab);

let i = 0;
let start = null;

port.onReceive((message) => {
  if (i === 0) {
    start = Date.now();

  } else if (i === 4999) {
    console.log(Date.now() - start);
  }

  ++i;
});

console.debug("OPTIONS STARTED");
