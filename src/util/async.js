import { assert } from "./assert";


export const concurrent = (...a) => Promise["all"](a);

export const async_callback = (f) => new Promise(f);

const loop = (resolve, reject, gen, value) => {
  const iteration = gen["next"](value);

  if (iteration["done"]) {
    resolve(iteration["value"]);

  } else {
    iteration["value"]["then"]((x) => {
      loop(resolve, reject, gen, x);
    }, (err) => {
      gen["throw"](err);
    });
  }
};

export const async = (f) =>
  new Promise((resolve, reject) => {
    loop(resolve, reject, f(), undefined);
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
