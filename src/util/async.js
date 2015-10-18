import * as list from "./list";
import { assert, crash } from "./assert";


const PENDING = 0;
const SUCCESS = 1;
const ERROR   = 2;

export const make = () => {
  return {
    _state: PENDING,
    _value: null,
    _waiting: list.make()
  };
};

export const done = (x) => {
  return {
    _state: SUCCESS,
    _value: x,
    _waiting: null
  };
};


export const success = (obj, value) => {
  if (obj._state === PENDING) {
    const a = obj._waiting;

    obj._state = SUCCESS;
    obj._value = value;
    obj._waiting = null;

    list.each(a, ({ out, success }) => {
      success(out, value);
    });

  } else {
    crash(new Error("async is not pending"));
  }
};

export const error = (obj, value) => {
  if (obj._state === PENDING) {
    const a = obj._waiting;

    obj._state = ERROR;
    obj._value = value;
    obj._waiting = null;

    list.each(a, ({ out, error }) => {
      error(out, value);
    });

  } else {
    crash(new Error("async is not pending"));
  }
};

const _run = (obj, out, success, error) => {
  if (obj._state === PENDING) {
    list.push(obj._waiting, { out, success, error });

  } else if (obj._state === SUCCESS) {
    success(out, obj._value);

  } else if (obj._state === ERROR) {
    error(out, obj._value);

  } else {
    crash();
  }
};

// TODO cancel the other asyncs when an error occurs ?
export const all = (a, f) => {
  const out = make();

  let pending = list.size(a);

  if (pending === 0) {
    // TODO this probably isn't tail-recursive
    _run(f(), out, success, error);

  } else {
    const values = new Array(pending);

    list.each(a, (x, i) => {
      _run(x, out, (out, value) => {
        values[i] = value;

        --pending;

        if (pending === 0) {
          // TODO this probably isn't tail-recursive
          _run(f(...values), out, success, error);
        }
      }, error);
    });
  }

  return out;
};

export const chain = (x, f) => {
  const out = make();

  _run(x, out, (out, value) => {
    // TODO this probably isn't tail-recursive
    _run(f(value), out, success, error);
  }, error);

  return out;
};

const on_fail = (out, x) => {
  assert(out === null);
  crash(x);
};

const run_fail = (x) => {
  const err = new Error("async must return undefined");

  _run(x, null, (out, x) => {
    assert(out === null);

    if (x !== undefined) {
      // TODO test this
      crash(err);
    }
  }, on_fail);
};

// TODO implement more efficiently ?
// TODO test this
export const run = (x, f) => {
  run_fail(chain(x, (value) => done(f(value))));
};

// TODO implement more efficiently ?
// TODO test this
export const run_all = (x, f) => {
  run_fail(all(x, (...value) => done(f(...value))));
};

const _ignore = (_) =>
  done(undefined);

export const ignore = (x) =>
  chain(x, _ignore);
