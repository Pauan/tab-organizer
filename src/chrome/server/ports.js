import { chrome } from "../../common/globals";
import { Bucket } from "../../util/mutable/bucket";
import { Event } from "../../util/stream";
import { Port } from "../common/ports";
import { each } from "../../util/iterator";
import { throw_error } from "../common/util";


const _ports = new Bucket();

const _port_connect = new Event();

// TODO test this
export const on_connect = (name) =>
  _port_connect.keep((port) => port.name === name);

chrome["runtime"]["onConnect"]["addListener"]((x) => {
  throw_error();

  const port = new Port(x);

  _ports.insert(port.name, port);

  // TODO is this correct ?
  // TODO a little hacky
  x["onDisconnect"]["addListener"](() => {
    _ports.remove(port.name, port);
  });

  _port_connect.send(port);
});

export const send = (name, value) => {
  each(_ports.get(name), (port) => {
    port.send(value);
  });
};
