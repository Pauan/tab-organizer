import { Bucket } from "../../util/bucket";
import { Port } from "../common/port";
import { each } from "../../util/iterator";
import { throw_error } from "../common/util";


const _ports      = new Bucket();
const _on_connect = new Bucket();


chrome["runtime"]["onConnect"]["addListener"]((x) => {
  throw_error();

  const port = new Port(x);

  _ports.add(port.name, port);

  port.on_disconnect(() => {
    _ports.remove(port.name, port);
  });

  each(_on_connect.get(port.name), (f) => {
    f(port);
  });
});


export const on_connect = (name, f) => {
  _on_connect.add(name, f);
};

export const ports = (name) =>
  _ports.get(name);

export const send = (name, value) => {
  each(ports(name), (port) => {
    port.send(value);
  });
};
