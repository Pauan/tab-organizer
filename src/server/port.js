import { Bucket } from "../util/bucket";
import { Port } from "../common/port";


const _ports     = new Bucket();
const _onConnect = new Bucket();


chrome["runtime"]["onConnect"]["addListener"]((x) => {
  const port = new Port(x);

  _ports.add(port._name, port);

  port.onDisconnect(() => {
    _ports.remove(port._name, port);
  });

  for (let f of _onConnect.get(port._name)) {
    f(port);
  }
});


export const onConnect = (name, f) => {
  _onConnect.add(name, f);
};

export const ports = (name) =>
  _ports.get(name);

export const send = (name, value) => {
  for (let port of ports(name)) {
    port.send(value);
  }
};
