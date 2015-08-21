import { assert, fail } from "./assert";
import { noop } from "./function";


const PENDING = 0;
const SUCCESS = 1;
const ERROR   = 2;

// TODO test this
class Async {
  constructor(f) {
    this._state = PENDING;
    this._value = null;
    this._waiting = [];

    f((value) => {
      if (this._state === PENDING) {
        const a = this._waiting;

        this._state = SUCCESS;
        this._value = value;
        this._waiting = null;

        for (let i = 0; i < a["length"]; ++i) {
          a[i].success(value);
        }
      }
    }, (error) => {
      if (this._state === PENDING) {
        const a = this._waiting;

        this._state = ERROR;
        this._value = error;
        this._waiting = null;

        for (let i = 0; i < a["length"]; ++i) {
          a[i].error(error);
        }
      }
    });
  }

  run(success, error) {
    if (this._state === PENDING) {
      this._waiting["push"]({ success, error });

    } else if (this._state === SUCCESS) {
      success(this._value);

    } else if (this._state === ERROR) {
      error(this._value);
    }
  }
}


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

export const async_callback = (f) =>
  new Async(f);

// TODO test this
export const async = (a, f) =>
  async_callback((success, error) => {
    let pending = a["length"];

    if (pending === 0) {
      success(f());

    } else {
      const out = new Array(a["length"]);

      for (let i = 0; i < a["length"]; ++i) {
        a[i].run((value) => {
          out[i] = value;

          --pending;

          if (pending === 0) {
            success(f(...out));
          }
        }, error);
      }
    }
  });

export const run_async = (a, f) => {
  const err = new Error("run_async function must return undefined");

  async(a, f).run((x) => {
    if (x !== undefined) {
      // TODO test this
      fail(err);
    }
  }, (err) => {
    // TODO test this
    fail(err);
  });
};

export const delay = (ms) =>
  async_callback((success, error) => {
    setTimeout(() => {
      success(undefined);
    }, ms);
  });

export const ignore = (x) =>
  async([x], noop);
