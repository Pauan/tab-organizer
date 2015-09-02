import * as set from "./set";
import * as maybe from "./maybe";
import { each } from "./iterator";
import { assert } from "./assert";


export const make = (info = {}) => {
  return {
    _listeners: set.make(),
    _info: info,
    _state: maybe.None
  };
};

const start = (event) => {
  const f = event._info.start;
  if (f) {
    assert(!maybe.has(state));
    event._state = maybe.Some(f(event));
  }
};

const stop = (event) => {
  const f = event._info.stop;
  if (f) {
    f(event, maybe.get(event._state));
    event._state = maybe.None;
  }
};

export const send = (event, value) => {
  each(event._listeners, (f) => {
    f(value);
  });
};

export const receive = (event, f) => {
  set.insert(event._listeners, f);

  // TODO test this
  if (set.size(event._listeners) === 1) {
    start(event);
  }

  return {
    stop: () => {
      set.remove(event._listeners, f);

      // TODO test this
      if (set.size(event._listeners) === 0) {
        stop(event);
      }
    }
  };
};

export const close = (event) => {
  // TODO test this
  if (set.size(event._listeners) !== 0) {
    stop(event);
  }

  event._listeners = null;
  event._info = null;
  event._state = null;
};
