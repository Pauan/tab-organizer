import { fail } from "../util/assert";
import { Set } from "../util/set";
import { each } from "../util/iterator";


export class Port {
  constructor(port) {
    this.name = port["name"];
    this._port = port;
    this._listeners = new Set();
    this._disconnects = new Set();

    // TODO test this
    port["onDisconnect"]["addListener"](() => {
      //this._port["disconnect"]();

      this._port = null;
      this._listeners = null;
      this._disconnects = null;

      each(this._disconnects, (f) => {
        f();
      });
    });

    port["onMessage"]["addListener"]((x) => {
      each(this._listeners, (f) => {
        f(x);
      });
    });
  }

  on_disconnect(f) {
    this._disconnects.add(f);
  }

  on_receive(f) {
    this._listeners.add(f);
  }

  send(value) {
    this._port["postMessage"](value);
  }

  toJSON() {
    fail();
  }
}
