import { uuid_port_tab } from "./common/uuid";
import { connect } from "./chrome/client";

const port = connect(uuid_port_tab);

let i = 0;
let start = null;

port.on_receive((message) => {
  if (i === 0) {
    start = Date.now();

  } else if (i === 4999) {
    console.log(Date.now() - start);
  }

  ++i;
});

console.debug("OPTIONS STARTED");
