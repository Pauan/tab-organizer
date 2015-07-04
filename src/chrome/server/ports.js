import { chrome } from "../../common/globals";
import { Bucket } from "../../util/mutable/bucket";
import { Event } from "../../util/event";
import { Port } from "../common/ports";
import { each } from "../../util/iterator";
import { throw_error } from "../common/util";


const _ports = new Bucket();

export const on_connect = new Event();


// TODO test this
chrome["runtime"]["onConnect"]["addListener"]((x) => {
  throw_error();

  const port = new Port(x);

  _ports.add(port.name, port);

  port.on_disconnect.listen(() => {
    _ports.remove(port.name, port);
  });

  on_connect.send(port);
});


export const get = (name) =>
  _ports.get(name);

export const send = (name, value) => {
  each(get(name), (port) => {
    port.send(value);
  });
};
