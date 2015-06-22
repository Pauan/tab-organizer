import { push } from "../util/array";


export class Port {
  constructor(port) {
    this._name = port["name"];
    this._port = port;
    this._listeners = [];
    this._disconnects = [];

    // TODO test this
    port["onDisconnect"]["addListener"](() => {
      //this._port["disconnect"]();

      for (let f of this._disconnects) {
        f();
      }

      this._name = null;
      this._port = null;
      this._listeners = null;
      this._disconnects = null;
    });

    port["onMessage"]["addListener"]((x) => {
      for (let f of this._listeners) {
        f(x);
      }
    });
  }

  onDisconnect(f) {
    push(this._disconnects, f);
  }

  onReceive(f) {
    push(this._listeners, f);
  }

  send(value) {
    this._port["postMessage"](value);
  }
}
