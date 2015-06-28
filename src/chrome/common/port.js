import { fail } from "../../util/assert";
import { Event } from "../../util/event";
import { each } from "../../util/iterator";


export class Port {
  constructor(port) {
    this.name = port["name"];

    this._port = port;
    this.on_receive = new Event();
    this.on_disconnect = new Event();

    // TODO test this
    port["onDisconnect"]["addListener"](() => {
      //this._port["disconnect"]();

      const on_disconnect = this.on_disconnect;

      this._port = null;
      this.on_receive = null;
      this.on_disconnect = null;

      on_disconnect.send(undefined);
    });

    port["onMessage"]["addListener"]((x) => {
      this.on_receive.send(x);
    });
  }

  send(value) {
    this._port["postMessage"](value);
  }

  toJSON() {
    fail();
  }
}
