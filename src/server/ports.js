import { push } from "../util/array";
import { Bucket } from "../util/bucket";


const _ports     = new Bucket();
const _onConnect = new Bucket();

class Port {
  constructor(port) {
    this._port = port;
    this._disconnected = false;
    this._listeners = [];
  }

  onMessage(f) {
    push(this._listeners, f);
  }

  send(value) {
    if (!this._disconnected) {
      this._port["postMessage"](value);
    }
  }
}

chrome["runtime"]["onConnect"]["addListener"]((x) => {
  const port = new Port(x);
  const name = x["name"];

  _ports.add(name, port);

  x["onDisconnect"]["addListener"](() => {
    port._disconnected = true;

    _ports.remove(name, port);
  });

  x["onMessage"]["addListener"]((x) => {
    for (let f of port._listeners) {
      f(x);
    }
  });

  for (let f of _onConnect.get(name)) {
    f(port);
  }
});

export const onConnect = (name, f) => {
  _onConnect.add(name, f);
};

export const ports = (name) =>
  _ports.get(name);
