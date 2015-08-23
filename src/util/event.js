import { each } from "./iterator";
import { Set } from "./mutable/set";
import { Some, None } from "./maybe";
//import { assert } from "./assert";


export const Event = (info = {}) => {
  const listeners = new Set();

  let state = None;

  const send = (value) => {
    each(listeners, (f) => {
      f(value);
    });
  };

  const start = () => {
    if (info.start) {
      // TODO
      //assert(!state.has());
      state = Some(info.start(e));
    }
  };

  const stop = () => {
    if (info.stop) {
      info.stop(e, state.get());
      state = None;
    }
  };

  // TODO test this
  // TODO shouldn't this get rid of the listeners ?
  const close = () => {
    if (listeners.size > 0) {
      stop();
    }
  };

  const receive = (f) => {
    listeners.insert(f);

    // TODO test this
    if (listeners.size === 1) {
      start();
    }

    return {
      stop: () => {
        listeners.remove(f);

        // TODO test this
        if (listeners.size === 0) {
          stop();
        }
      }
    };
  };

  const e = {
    send,
    close,
    receive
  };

  return e;
};
