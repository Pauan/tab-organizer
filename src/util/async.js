import * as list from "./list";
import { assert, fail } from "./assert";
import { noop } from "./functions";


const PENDING = 0;
const SUCCESS = 1;
const ERROR   = 2;

/*export const concurrent = (...a) =>
  new Async((success, error) => {
    let pending = a["length"];

    const values = new Array(a["length"]);

    for (let i = 0; i < a["length"]; ++i) {
      a[i].run((x) => {
        values[i] = x;

        --pending;

        if (pending === 0) {
          success(values);
        }
      }, error);
    }
  });*/

export const async_callback = (f) => {
  const obj = {
    _state: PENDING,
    _value: null,
    _waiting: list.make()
  };

  f(obj);

  return obj;
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
  }
};

const run = (obj, success, error) => {
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

// TODO test this
export const async = (a, f) =>
  async_callback((out) => {
    let pending = list.size(a);

    if (pending === 0) {
      success(out, f());

    } else {
      const values = new Array(pending);

      list.each(a, (x, i) => {
        run(x, (value) => {
          values[i] = value;

          --pending;

          if (pending === 0) {
            success(out, f(...values));
          }

        }, (e) => {
          error(out, e);
        });
      });
    }
  });

export const run_async = (a, f) => {
  const err = new Error("run_async function must return undefined");

  async(a, (...values) => {
    const x = f(...values);

    if (x !== undefined) {
      // TODO test this
      fail(err);
    }
  });
};

export const ignore = (x) =>
  async([x], noop);
