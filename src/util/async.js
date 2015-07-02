import { assert } from "./assert";


export const concurrent = (...a) => Promise["all"](a);

export const async_callback = (f) => new Promise(f);

const loop = (gen, method, on_success, on_error, value) => {
  const iteration = gen[method](value);

  if (iteration["done"]) {
    return Promise["resolve"](iteration["value"]);

  } else {
    return iteration["value"]["then"](on_success, on_error);
  }
};

export const async = (f) =>
  new Promise((success, error) => {
    const gen = f();

    const on_success = (x) =>
      loop(gen, "next", on_success, on_error, x);

    const on_error = (err) =>
      loop(gen, "throw", on_success, on_error, err);

    success(loop(gen, "next", on_success, on_error, undefined));
  });

export const run_async = (f) => {
  const err = new Error("run_async function must return undefined");

  async(f)["then"]((x) => {
    if (x !== undefined) {
      console["error"](err["stack"]);
    }
  }, (err) => {
    console["error"](err["stack"]);
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
