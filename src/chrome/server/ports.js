import { chrome } from "../../common/globals";
import { Event } from "../../util/stream";
import { Port } from "../common/ports";
import { check_error } from "../common/util";


const { input, output } = Event();

// TODO test this
export const on_connect = (name) =>
  output.keep((port) => port.name === name);

chrome["runtime"]["onConnect"]["addListener"]((x) => {
  const err = check_error();

  if (err === null) {
    input.send(new Port(x));

  } else {
    input.error(err);
  }
});
