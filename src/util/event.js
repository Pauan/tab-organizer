import { each } from "./iterator";
import { Set } from "./immutable/set";
import { Some, None } from "./immutable/maybe";
import { assert } from "./assert";


export const Event = (info = {}) => {
  // TODO use mutable Set ?
  let listeners = Set();
  let state = None;

  const send = (value) => {
    each(listeners, (f) => {
      f(value);
    });
  };

  const start = () => {
    if (info.start) {
      assert(!state.has());
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
  const close = () => {
    const a = listeners;

    listeners = null;

    if (a.size > 0) {
      stop();
    }
  };

  const receive = (f) => {
    listeners = listeners.insert(f);

    // TODO test this
    if (listeners.size === 1) {
      start();
    }

    return {
      stop: () => {
        listeners = listeners.remove(f);

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
