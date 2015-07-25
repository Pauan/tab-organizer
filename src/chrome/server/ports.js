import { chrome } from "../../common/globals";
import { Event } from "../../util/event";
import { Port } from "../common/ports";
import { throw_error } from "../common/util";


const _events = Event({
  start: (e) => {
    const onConnect = (x) => {
      throw_error();

      e.send(new Port(x));
    };

    chrome["runtime"]["onConnect"]["addListener"](onConnect);

    return { onConnect };
  },
  stop: (e, { onConnect }) => {
    chrome["runtime"]["onConnect"]["removeListener"](onConnect);
  }
});

// TODO test this
export const on_connect = (name, f) =>
  _events.receive((port) => {
    if (port.name === name) {
      f(port);
    }
  });
