import * as list from "./list";
import { assert, fail } from "./assert";


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

    list.each(a, (x) => {
      x.success(value);
    });

  } else {
    fail(new Error("async is not pending"));
  }
};

export const error = (obj, error) => {
  if (obj._state === PENDING) {
    const a = obj._waiting;

    obj._state = ERROR;
    obj._value = error;
    obj._waiting = null;

    list.each(a, (x) => {
      x.error(error);
    });

  } else {
    fail(new Error("async is not pending"));
  }
};

const _run = (obj, success, error) => {
  if (obj._state === PENDING) {
    list.push(obj._waiting, { success, error });

  } else if (obj._state === SUCCESS) {
    success(obj._value);

  } else if (obj._state === ERROR) {
    error(obj._value);

  } else {
    fail();
  }
};

export const all = (a, f) => {
  const out = make();

  const on_success = (x) => {
    success(out, x);
  };

  // TODO cancel all the other ones, or something ?
  const on_error = (x) => {
    error(out, x);
  };

  let pending = list.size(a);

  if (pending === 0) {
    _run(f(), on_success, on_error);

  } else {
    const values = new Array(pending);

    list.each(a, (x, i) => {
      _run(x, (value) => {
        values[i] = value;

        --pending;

        if (pending === 0) {
          _run(f(...values), on_success, on_error);
        }
      }, on_error);
    });
  }

  return out;
};

export const wait = (x, f) => {
  const out = make();

  const on_success = (x) => {
    success(out, x);
  };

  const on_error = (x) => {
    error(out, x);
  };

  _run(x, (value) => {
    // TODO this probably isn't tail-recursive
    _run(f(value), on_success, on_error);
  }, on_error);

  return out;
};

const run_fail = (x) => {
  const err = new Error("async must return undefined");

  _run(x, (x) => {
    if (x !== undefined) {
      // TODO test this
      fail(err);
    }
  }, fail);
};

// TODO implement more efficiently ?
// TODO test this
export const run = (x, f) => {
  run_fail(wait(x, (value) => done(f(value))));
};

// TODO implement more efficiently ?
// TODO test this
export const run_all = (x, f) => {
  run_fail(all(x, (...value) => done(f(...value))));
};

export const ignore = (x) =>
  wait(x, (_) => done(undefined));
