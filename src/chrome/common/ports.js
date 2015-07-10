import { Event } from "../../util/stream";
import { to_json, from_json } from "../../util/immutable/json";
import { check_error } from "./util";


export class Port {
  constructor(port) {
    const on_receive = new Event();

    const onMessage = (x) => {
      const err = check_error();

      if (err === null) {
        // TODO is using `from_json` here correct ?
        on_receive.send(from_json(x));

      } else {
        cleanup();
        this._cleanup();
        on_receive.error(err);
      }
    };

    const onDisconnect = () => {
      //this._port["disconnect"]();

      cleanup();
      this._cleanup();

      const err = check_error();
      if (err === null) {
        on_receive.complete();

      } else {
        on_receive.error(err);
      }
    };

    // TODO test this
    const cleanup = () => {
      port["onMessage"]["removeListener"](onMessage);
      port["onDisconnect"]["removeListener"](onDisconnect);
    };

    port["onMessage"]["addListener"](onMessage);
    port["onDisconnect"]["addListener"](onDisconnect);

    this.name = port["name"];
    this._port = port;
    this.on_receive = on_receive;
  }

  _cleanup() {
    this._port = null;
    this.on_receive = null;
  }

  send(value) {
    // TODO is using `to_json` here correct ?
    this._port["postMessage"](to_json(value));
  }
}
