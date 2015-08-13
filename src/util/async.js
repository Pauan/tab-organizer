import { assert, fail } from "./assert";


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

const loop = (gen, method, value, on_success, on_error, on_end) => {
  const iteration = gen[method](value);

  if (iteration["done"]) {
    on_end(iteration["value"]);

  } else {
    iteration["value"].run(on_success, on_error);
  }
};

// TODO test this
export const async = (f) =>
  async_callback((success, error) => {
    const gen = f();

    const on_success = (x) => {
      loop(gen, "next", x, on_success, on_error, success);
    };

    const on_error = (err) => {
      // TODO is this inefficient ?
      // TODO test this
      try {
        loop(gen, "throw", err, on_success, on_error, success);
      } catch (e) {
        error(e);
      }
    };

    loop(gen, "next", undefined, on_success, on_error, success);
  });

export const run_async = (f) => {
  const err = new Error("run_async function must return undefined");

  async(f).run((x) => {
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
  async(function* () {
    yield x;
  });
