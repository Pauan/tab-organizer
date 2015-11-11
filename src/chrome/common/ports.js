import * as event from "../../util/event";
import { throw_error, callback } from "./util";


export const make = (port) => {
  const o = {
    _name: port["name"],
    _port: port,

    _on_receive: event.make({
      start: (e) => {
        const onMessage = callback((x) => {
          throw_error();

          event.send(e, x);
        });

        port["onMessage"]["addListener"](onMessage);

        return { onMessage };
      },
      stop: (e, { onMessage }) => {
        port["onMessage"]["removeListener"](onMessage);
      }
    }),

    _on_close: event.make()
  };


  // TODO test this
  const onDisconnect = callback(() => {
    // TODO do we need to remove the onMessage listener ?
    port["onDisconnect"]["removeListener"](onDisconnect);

    throw_error();

    const on_receive = o._on_receive;
    const on_close = o._on_close;

    o._name = null;
    o._port = null;
    o._on_receive = null;
    o._on_close = null;

    event.send(on_close, undefined);

    event.close(on_receive);
    event.close(on_close);
  });

  port["onDisconnect"]["addListener"](onDisconnect);

  return o;
};


export const on_receive = (port, f) =>
  event.on_receive(port._on_receive, f);

// TODO test this
export const on_close = (port, f) =>
  event.on_receive(port._on_close, f);

export const send = (port, value) => {
  port._port["postMessage"](value);
};
