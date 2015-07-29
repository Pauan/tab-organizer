import { Event } from "../../util/event";
import { throw_error } from "./util";


export class Port {
  constructor(port) {
    const on_receive = Event({
      start: (e) => {
        const onMessage = (x) => {
          throw_error();

          e.send(x);
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
    this._port["postMessage"](value);
  }
}
