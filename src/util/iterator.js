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

export const to_array = (x) =>
  Array["from"](x);

// TODO test this
export const empty = {
  [Symbol["iterator"]]: () => {
    return {
      "next": () => {
        return { "done": true };
      }
    };
  }
};

export const iterator = (x) => x[Symbol["iterator"]]();

export const entries = (o) =>
  map(Object["keys"](o), (key) => [key, o[key]]);

export const reverse = (iter) => {
  const a = to_array(iter);

  // TODO faster version of this
  a["reverse"]();

  return iterator(a);
};

export const each = (iter, f) => {
  for (let x of iter) {
    f(x);
  }
};

export const foldl = (current, iter, f) => {
  for (let x of iter) {
    current = f(current, x);
  }
  return current;
};

export const foldr = (current, iter, f) =>
  foldl(current, reverse(iter), f);

export const join = (iter, s = "") => {
  let first = true;

  let out = "";

  for (let x of iter) {
    if (first) {
      first = false;
      out = out + x;

    } else {
      out = out + s + x;
    }
  }

  return out;
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

export const all = (iter, f) => {
  for (let x of iter) {
    if (!f(x)) {
      return false;
    }
  }
  return true;
};

export const any = (iter, f) => {
  for (let x of iter) {
    if (f(x)) {
      return true;
    }
  }
  return false;
};

export const indexed = function* (iter) {
  let i = 0;

  for (let x of iter) {
    yield [i, x];
    ++i;
  }
};

export const zip = (...iter) => {
  return {
    [Symbol["iterator"]]: () => {
      const a = iter["map"](iterator);

      return {
        "next": () => {
          const out = new Array(a["length"]);

          for (let i = 0; i < a["length"]; ++i) {
            const x = a[i]["next"]();
            if (x["done"]) {
              return { "done": true };
            } else {
              out[i] = x["value"];
            }
          }

          return { "done": false, "value": out };
        }
      };
    }
  };
};

// TODO code duplication
export const zip_longest = (def, ...iter) => {
  return {
    [Symbol["iterator"]]: () => {
      const a = iter["map"](iterator);

      return {
        "next": () => {
          const out = new Array(a["length"]);

          let done = 0;

          for (let i = 0; i < a["length"]; ++i) {
            // TODO this calls the "next" method after the iterator is done
            const x = a[i]["next"]();
            if (x["done"]) {
              out[i] = def;
              ++done;
            } else {
              out[i] = x["value"];
            }
          }

          if (done === a["length"]) {
            return { "done": true };
          } else {
            return { "done": false, "value": out };
          }
        }
      };
    }
  };
};
