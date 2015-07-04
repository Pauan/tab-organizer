import { Event } from "../../util/event";
import { each } from "../../util/iterator";
import { to_json, from_json } from "../../util/immutable/json";


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
      // TODO is using `from_json` here correct ?
      this.on_receive.send(from_json(x));
    });
  }

  send(value) {
    // TODO is using `to_json` here correct ?
    this._port["postMessage"](to_json(value));
  }
}
