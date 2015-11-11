import * as event from "../../util/event";
import * as ports from "../common/ports";
import { chrome } from "../../common/globals";
import { throw_error, callback } from "../common/util";
import { on_receive, on_close, send } from "../common/ports";
export { on_receive, on_close, send } from "../common/ports";


const _events = event.make({
  start: (e) => {
    const onConnect = callback((x) => {
      throw_error();

      event.send(e, ports.make(x));
    });

    chrome["runtime"]["onConnect"]["addListener"](onConnect);

    return { onConnect };
  },
  stop: (e, { onConnect }) => {
    chrome["runtime"]["onConnect"]["removeListener"](onConnect);
  }
});

// TODO test this
export const on_open = (name, f) =>
  event.on_receive(_events, (port) => {
    if (port._name === name) {
      f(port);
    }
  });
