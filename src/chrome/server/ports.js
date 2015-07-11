import { chrome } from "../../common/globals";
import { Event } from "../../util/stream";
import { Port } from "../common/ports";
import { check_error } from "../common/util";


const _port_connect = new Event();

// TODO test this
export const on_connect = (name) =>
  _port_connect.keep((port) => port.name === name);

chrome["runtime"]["onConnect"]["addListener"]((x) => {
  const err = check_error();

  if (err === null) {
    _port_connect.send(new Port(x));

  } else {
    _port_connect.error(err);
  }
});
