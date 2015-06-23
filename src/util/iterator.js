/*
// TODO is this correct ?
// TODO maybe use yield* instead ?
export const iterator = (x) =>
  x[Symbol["iterator"]]();

export const empty = {
  [Symbol["iterator"]]: () => {
    return {
      "next": () => {
        return {
          "done": true
        };
      };
    };
  };
};*/

export const each = (iter, f) => {
  for (let x of iter) {
    f(x);
  }
};

export const map = function* (iter, f) {
  for (let x of iter) {
    yield f(x);
  }
};

export const keep = function* (iter, f) {
  for (let x of iter) {
    if (f(x)) {
      yield x;
    }
  }
};
