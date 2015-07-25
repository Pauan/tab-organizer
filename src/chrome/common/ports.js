import { Event } from "../../util/event";
import { to_json, from_json } from "../../util/immutable/json";
import { throw_error } from "./util";


export class Port {
  constructor(port) {
    const on_receive = Event({
      start: (e) => {
        const onMessage = (x) => {
          throw_error();

          // TODO is using `from_json` here correct ?
          e.send(from_json(x));
        };

        port["onMessage"]["addListener"](onMessage);

        return { onMessage };
      },
      stop: (e, { onMessage }) => {
        port["onMessage"]["removeListener"](onMessage);
      }
    });


    const on_disconnect = Event();

    // TODO test this
    const onDisconnect = () => {
      throw_error();

      this._port = null;
      this.on_receive = null;
      this.on_disconnect = null;

      port["onDisconnect"]["removeListener"](onDisconnect);

      on_disconnect.send(undefined);

      on_receive.close();
      on_disconnect.close();
    };

    port["onDisconnect"]["addListener"](onDisconnect);


    this.name          = port["name"];
    this._port         = port;
    this.on_receive    = on_receive.receive;
    this.on_disconnect = on_disconnect.receive;
  }

  send(value) {
    // TODO is using `to_json` here correct ?
    this._port["postMessage"](to_json(value));
  }
}
